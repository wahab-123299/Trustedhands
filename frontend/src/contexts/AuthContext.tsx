import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
  useContext,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import { authApi, userApi, artisanApi, RegisterData } from "@/services/api";
import { User, ArtisanProfile } from "@/types";

const debugLogs: string[] = [];
const addLog = (msg: string) => {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  debugLogs.push(line);
  console.log(line);
  if (debugLogs.length > 100) debugLogs.shift();
};

if (typeof window !== 'undefined') {
  (window as any).getAuthLogs = () => {
    console.log('=== AUTH CONTEXT LOGS ===\n' + debugLogs.join('\n'));
    return debugLogs;
  };
  (window as any).clearAuthLogs = () => {
    debugLogs.length = 0;
  };
}

interface AuthResponseData {
  user: User;
  artisanProfile?: ArtisanProfile | null;
  dashboardRoute?: string;
  accessToken?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  artisanProfile: ArtisanProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (data: RegisterData, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  updateArtisanProfile: (data: Partial<ArtisanProfile>) => void;
  refreshUser: () => Promise<void>;
  updateUserFromOAuth: (user: User, token: string) => void;
  socket: Socket | null;
  socketConnected: boolean;
}

interface AuthState {
  user: User | null;
  token: string | null;
  artisanProfile: ArtisanProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    artisanProfile: null,
    isAuthenticated: false,
    isLoading: true,
    isInitialized: false,
  });

  const [socket, setSocket] = useState<Socket | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const socketRef = useRef<Socket | null>(null);

  const hasInitialized = useRef(false);
  const isLoggingIn = useRef(false);

  const API_URL = import.meta.env.VITE_API_URL || "https://trustedhands.onrender.com/api";
  const SOCKET_URL = API_URL.replace("/api", "");


  const getToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }, []);

  const storeToken = useCallback((token: string, rememberMe: boolean = true): void => {
    if (typeof window === 'undefined') return;

    if (rememberMe) {
      localStorage.setItem('token', token);
      localStorage.setItem('rememberMe', 'true');
    } else {
      sessionStorage.setItem('token', token);
      localStorage.removeItem('rememberMe');
    }
  }, []);

  const clearTokens = useCallback((): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('user');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('refreshToken');
    sessionStorage.removeItem('user');
  }, []);


  const disconnectSocket = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setSocketConnected(false);
    }
  }, []);

  const connectSocket = useCallback((userId: string, currentToken: string) => {
    if (socketRef.current?.connected) return;
    disconnectSocket();

    addLog(`[Socket] Connecting to: ${SOCKET_URL}`);
    addLog(`[Socket] Token present: ${!!currentToken}`);

    const socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: { 
        userId,
        token: currentToken
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      forceNew: true,
      autoConnect: true,
    });

    socketInstance.on("connect", () => {
      addLog('[Socket] Connected successfully');
      setSocketConnected(true);
      socketInstance.emit("join_personal", { userId });
    });

    socketInstance.on("disconnect", (reason) => {
      addLog(`[Socket] Disconnected: ${reason}`);
      setSocketConnected(false);

      if (reason === 'io server disconnect') {
        addLog('[Socket] Server disconnected, will reconnect...');
        setTimeout(() => socketInstance.connect(), 2000);
      }
    });

    socketInstance.on("connect_error", (err) => {
      addLog(`[Socket] Connection error: ${err.message}`);

      if (err.message.includes('jwt expired') || 
          err.message.includes('AUTH_TOKEN_REQUIRED') ||
          err.message.includes('invalid token')) {
        addLog('[Socket] Token invalid/expired - logging out');
        disconnectSocket();
        clearTokens();
        setState({
          user: null,
          token: null,
          artisanProfile: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
        });
        navigate('/login');
        toast.error('Session expired. Please log in again.');
      }
    });

    socketInstance.on("error", (err: any) => {
      addLog(`[Socket] Server error: ${err.message || err}`);
    });

    socketInstance.io.on("reconnect", (attempt) => {
      addLog(`[Socket] Reconnected after ${attempt} attempts`);
      setSocketConnected(true);
      socketInstance.emit("join_personal", { userId });
    });

    socketInstance.io.on("reconnect_attempt", (attempt) => {
      addLog(`[Socket] Reconnect attempt ${attempt}`);
    });

    socketInstance.io.on("reconnect_error", (err) => {
      addLog(`[Socket] Reconnect error: ${err.message}`);
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);
  }, [disconnectSocket, SOCKET_URL, navigate, clearTokens]);


  // ✅ FIXED: Helper to safely extract artisan data from API response
  const extractArtisanFromResponse = useCallback((response: any): ArtisanProfile | null => {
    if (!response?.data?.data) {
      addLog('[ExtractArtisan] No data in response');
      return null;
    }
    
    // Backend returns { success: true, data: { artisan: {...} } }
    if (response.data.data.artisan) {
      addLog('[ExtractArtisan] Found artisan in data.artisan');
      return response.data.data.artisan as ArtisanProfile;
    }
    
    // Backend returns { success: true, data: {...} } directly
    // Check if it looks like an artisan profile (has required fields)
    const data = response.data.data;
    if (data.userId && (data.profession || data.skills || data.bio !== undefined)) {
      addLog('[ExtractArtisan] Found artisan directly in data');
      return data as ArtisanProfile;
    }
    
    addLog(`[ExtractArtisan] Could not find artisan. Keys: ${Object.keys(data).join(', ')}`);
    return null;
  }, []);


  useEffect(() => {
    if (hasInitialized.current) {
      addLog('[Init] Already initialized, skipping');
      return;
    }
    hasInitialized.current = true;

    const initAuth = async () => {
      if (isLoggingIn.current) {
        addLog('[Init] Login in progress, skipping init');
        return;
      }

      try {
        addLog('[Init] === STARTING AUTH INITIALIZATION ===');
        setState((prev) => ({ ...prev, isLoading: true }));

        const token = getToken();
        addLog(`[Init] Token from storage: ${token ? 'EXISTS (' + token.substring(0, 20) + '...)' : 'NULL'}`);

        if (!token) {
          addLog('[Init] No token, setting unauthenticated');
          setState({
            user: null,
            token: null,
            artisanProfile: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
          });
          return;
        }

        addLog('[Init] Calling userApi.getMe()...');
        const response = await userApi.getMe();

        addLog(`[Init] SUCCESS! Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
        const res = response.data as ApiResponse<AuthResponseData>;
        const { user, artisanProfile } = res.data;

        addLog(`[Init] User: ${user.email}, Role: ${user.role}`);

        // ✅ FIXED: If user is artisan but no profile in user response, fetch it separately
        let finalArtisanProfile: ArtisanProfile | null = artisanProfile || null;
        
        if (user.role === 'artisan' && !finalArtisanProfile) {
          addLog('[Init] User is artisan but no profile in /users/me, fetching /artisans/me...');
          try {
            const artisanRes = await artisanApi.getMyProfile();
            addLog(`[Init] /artisans/me response: ${JSON.stringify(artisanRes.data).substring(0, 150)}...`);
            
            finalArtisanProfile = extractArtisanFromResponse(artisanRes);
            
            if (finalArtisanProfile) {
              addLog('[Init] Artisan profile loaded successfully');
            } else {
              addLog('[Init] Artisan profile response had no usable data');
            }
          } catch (err: any) {
            if (err.response?.status === 404) {
              addLog('[Init] Artisan profile not found (404) - profile not created yet');
            } else {
              addLog(`[Init] Failed to load artisan profile: ${err.message}`);
            }
            finalArtisanProfile = null;
          }
        }

        setState({
          user,
          token,
          artisanProfile: finalArtisanProfile,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id, token);
        addLog('[Init] === AUTH INITIALIZATION COMPLETE ===');
      } catch (error: any) {
        addLog(`[Init] FAILED: ${error.message}`);
        addLog(`[Init] Status: ${error.response?.status}`);
        addLog(`[Init] Error data: ${JSON.stringify(error.response?.data)}`);

        if (error.response?.status === 401 || 
            error.message?.includes('jwt expired')) {
          addLog('[Init] Clearing token (401/expired)');
          clearTokens();
        }

        setState({
          user: null,
          token: null,
          artisanProfile: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
        });

        addLog('[Init] === AUTH INITIALIZATION FAILED ===');
      }
    };

    const timer = setTimeout(initAuth, 100);

    return () => {
      clearTimeout(timer);
      disconnectSocket();
    };
  }, [connectSocket, disconnectSocket, getToken, clearTokens, extractArtisanFromResponse]);


  // ==========================================
  // CRITICAL FIX: Extract real error message from API error
  // ==========================================
  const extractErrorMessage = useCallback((err: any): string => {
    addLog(`[extractErrorMessage] Extracting from error: ${JSON.stringify({
      message: err?.message,
      status: err?.response?.status,
      code: err?.response?.data?.error?.code,
      serverMessage: err?.response?.data?.error?.message,
    })}`);

    // Priority 1: Server error response message (most specific)
    if (err?.response?.data?.error?.message) {
      addLog(`[extractErrorMessage] Found server message: "${err.response.data.error.message}"`);
      return err.response.data.error.message;
    }

    // Priority 2: Server error response code mapped to user-friendly message
    if (err?.response?.data?.error?.code) {
      const code = err.response.data.error.code;
      const codeMap: Record<string, string> = {
        'AUTH_INVALID_CREDENTIALS': 'Email or password is incorrect',
        'AUTH_USER_NOT_FOUND': 'No account found with this email',
        'AUTH_ACCOUNT_LOCKED': 'Account temporarily locked. Try again later',
        'AUTH_EMAIL_NOT_VERIFIED': 'Please verify your email before logging in',
        'AUTH_TOO_MANY_ATTEMPTS': 'Too many attempts. Please try again later',
        'AUTH_TOKEN_EXPIRED': 'Session expired. Please log in again.',
        'AUTH_UNAUTHORIZED': 'Access denied. Please log in again.',
      };
      const mapped = codeMap[code];
      if (mapped) {
        addLog(`[extractErrorMessage] Mapped code "${code}" to: "${mapped}"`);
        return mapped;
      }
    }

    // Priority 3: If it's a 401 with no specific message, give a helpful hint
    if (err?.response?.status === 401) {
      addLog(`[extractErrorMessage] Generic 401 - suggesting credentials issue`);
      return 'Email or password is incorrect';
    }

    // Priority 4: Direct message property (filter out the refresh token red herring)
    if (err?.message && !err.message.toLowerCase().includes('refresh token')) {
      addLog(`[extractErrorMessage] Using error.message: "${err.message}"`);
      return err.message;
    }

    // Priority 5: Response status text
    if (err?.response?.statusText) {
      addLog(`[extractErrorMessage] Using statusText: "${err.response.statusText}"`);
      return `Error ${err.response.status}: ${err.response.statusText}`;
    }

    addLog(`[extractErrorMessage] Fallback message`);
    return 'Login failed. Please try again.';
  }, []);


  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean = true) => {
      try {
        isLoggingIn.current = true;
        setState((prev) => ({ ...prev, isLoading: true }));

        addLog(`[Login] Starting login for: ${email} (rememberMe: ${rememberMe})`);

        const response = await authApi.login({ email, password });
        const res = response.data as ApiResponse<AuthResponseData>;

        const { user, artisanProfile, dashboardRoute, accessToken } = res.data;

        addLog(`[Login] Success! Token: ${!!accessToken}`);
        if (accessToken) {
          addLog(`[Login] Token length: ${accessToken.length}`);
        }

        if (!accessToken) {
          throw new Error('No access token received from server');
        }

        storeToken(accessToken, rememberMe);

        const savedToken = getToken();
        addLog(`[Login] Token saved to storage: ${!!savedToken}`);
        addLog(`[Login] Saved token matches: ${savedToken === accessToken}`);

        // ✅ FIXED: If user is artisan but no profile in login response, fetch it
        let finalArtisanProfile: ArtisanProfile | null = artisanProfile || null;
        if (user.role === 'artisan' && !finalArtisanProfile) {
          addLog('[Login] User is artisan but no profile in login response, fetching /artisans/me...');
          try {
            const artisanRes = await artisanApi.getMyProfile();
            finalArtisanProfile = extractArtisanFromResponse(artisanRes);
            
            if (finalArtisanProfile) {
              addLog('[Login] Artisan profile loaded successfully');
            }
          } catch (err: any) {
            if (err.response?.status === 404) {
              addLog('[Login] Artisan profile not found (404) - profile not created yet');
            } else {
              addLog(`[Login] Failed to load artisan profile: ${err.message}`);
            }
            finalArtisanProfile = null;
          }
        }

        setState({
          user,
          token: accessToken,
          artisanProfile: finalArtisanProfile,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id, accessToken);
        toast.success(`Welcome ${user.fullName}`);

        const destination = location.state?.from?.pathname || dashboardRoute || '/';
        addLog(`[Login] Destination: ${destination}`);

        await new Promise(r => setTimeout(r, 500));

        addLog('[Login] Navigating now...');
        isLoggingIn.current = false;
        navigate(destination, { replace: true });

      } catch (err: any) {
        // CRITICAL FIX: Extract the REAL error message, not the refresh token red herring
        const message = extractErrorMessage(err);

        addLog(`[Login] FAILED: ${message}`);
        addLog(`[Login] Raw error message: ${err?.message || 'N/A'}`);
        addLog(`[Login] Error response status: ${err?.response?.status || 'N/A'}`);
        addLog(`[Login] Error response data: ${JSON.stringify(err?.response?.data || {})}`);

        isLoggingIn.current = false;
        setState((prev) => ({ ...prev, isLoading: false }));

        // Show the real error to user via toast
        toast.error(message);

        // Re-throw with clean message for UI components
        throw new Error(message);
      }
    },
    [connectSocket, navigate, location.state, storeToken, getToken, extractErrorMessage, extractArtisanFromResponse]
  );


  const register = useCallback(
    async (data: RegisterData, rememberMe: boolean = true) => {
      try {
        isLoggingIn.current = true;
        setState((prev) => ({ ...prev, isLoading: true }));

        addLog(`[Register] Starting for: ${data.email} (rememberMe: ${rememberMe})`);

        const response = await authApi.register(data);
        const res = response.data as ApiResponse<AuthResponseData>;

        const { user, artisanProfile, dashboardRoute, accessToken } = res.data;

        addLog(`[Register] Success! Token: ${!!accessToken}`);

        if (!accessToken) {
          throw new Error('No access token received from server');
        }

        storeToken(accessToken, rememberMe);
        addLog('[Register] Token saved');

        setState({
          user,
          token: accessToken,
          artisanProfile: artisanProfile || null,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id, accessToken);
        toast.success("Registration successful");

        const destination = dashboardRoute || '/';

        await new Promise(r => setTimeout(r, 500));

        isLoggingIn.current = false;
        navigate(destination, { replace: true });

      } catch (err: any) {
        const message = extractErrorMessage(err);

        addLog(`[Register] FAILED: ${message}`);
        addLog(`[Register] Raw error: ${err.message}`);
        addLog(`[Register] Error response: ${JSON.stringify(err.response?.data)}`);

        isLoggingIn.current = false;
        setState((prev) => ({ ...prev, isLoading: false }));

        toast.error(message);
        throw new Error(message);
      }
    },
    [connectSocket, navigate, storeToken, extractErrorMessage]
  );


  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.log('Logout API failed:', err);
    }

    disconnectSocket();

    addLog('[Logout] Clearing all tokens');
    clearTokens();

    setState({
      user: null,
      token: null,
      artisanProfile: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
    });

    navigate("/login", { replace: true });
    toast.success("Logged out successfully");
  }, [disconnectSocket, navigate, clearTokens]);


  const updateUserFromOAuth = useCallback((user: User, token: string) => {
    addLog(`[OAuth] Updating user from OAuth: ${user.email}`);


    localStorage.setItem('token', token);
    localStorage.setItem('rememberMe', 'true');

    setState({
      user,
      token,
      artisanProfile: null,
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
    });

    connectSocket(user._id, token);
    addLog('[OAuth] User updated and socket connected');
  }, [connectSocket]);


  // ✅ FIXED: refreshUser now fetches artisan profile separately with proper extraction
  const refreshUser = useCallback(async () => {
    try {
      addLog('[RefreshUser] Refreshing...');
      const response = await userApi.getMe();
      const res = response.data as ApiResponse<AuthResponseData>;
      const { user, artisanProfile } = res.data;

      // ✅ FIXED: If user is artisan but no profile in response, fetch it
      let finalArtisanProfile: ArtisanProfile | null = artisanProfile || null;
      if (user.role === 'artisan' && !finalArtisanProfile) {
        addLog('[RefreshUser] User is artisan but no profile, fetching /artisans/me...');
        try {
          const artisanRes = await artisanApi.getMyProfile();
          finalArtisanProfile = extractArtisanFromResponse(artisanRes);
          
          if (finalArtisanProfile) {
            addLog('[RefreshUser] Artisan profile loaded successfully');
          }
        } catch (err: any) {
          if (err.response?.status === 404) {
            addLog('[RefreshUser] Artisan profile not found (404)');
          } else {
            addLog(`[RefreshUser] Failed to load artisan profile: ${err.message}`);
          }
          finalArtisanProfile = null;
        }
      }

      setState((prev) => ({
        ...prev,
        user,
        artisanProfile: finalArtisanProfile,
        isAuthenticated: true,
      }));
      addLog('[RefreshUser] Success');
    } catch (error: any) {
      addLog(`[RefreshUser] Failed: ${error.message}`);
      if (error.response?.status === 401) {
        clearTokens();
        setState({
          user: null,
          token: null,
          artisanProfile: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
        });
        navigate('/login');
      }
    }
  }, [navigate, clearTokens, extractArtisanFromResponse]);

  const updateUser = useCallback((data: Partial<User>) => {
    setState((prev) => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...data } : null,
    }));
  }, []);

  const updateArtisanProfile = useCallback(
    (data: Partial<ArtisanProfile>) => {
      setState((prev) => ({
        ...prev,
        artisanProfile: prev.artisanProfile
          ? { ...prev.artisanProfile, ...data }
          : null,
      }));
    },
    []
  );


  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    updateArtisanProfile,
    refreshUser,
    updateUserFromOAuth,
    socket,
    socketConnected,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};



export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};

export default AuthContext;