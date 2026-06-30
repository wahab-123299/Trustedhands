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
  updateUserFromOAuth: (user: User, token: string, refreshToken?: string) => void;
  updateArtisanProfile: (data: Partial<ArtisanProfile>) => void;
  refreshUser: () => Promise<void>;
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

  const getRefreshToken = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
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

  const storeRefreshToken = useCallback((refreshToken: string, rememberMe: boolean = true): void => {
    if (typeof window === 'undefined') return;
    if (rememberMe) {
      localStorage.setItem('refreshToken', refreshToken);
    } else {
      sessionStorage.setItem('refreshToken', refreshToken);
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

  const extractArtisanFromResponse = useCallback((response: any): ArtisanProfile | null => {
    if (!response?.data?.data) {
      addLog('[ExtractArtisan] No data in response');
      return null;
    }

    const data = response.data.data;

    if (data.artisanProfile) {
      addLog('[ExtractArtisan] Found artisanProfile in response');
      return data.artisanProfile as ArtisanProfile;
    }

    if (data.artisan) {
      addLog('[ExtractArtisan] Found artisan in data.artisan');
      return data.artisan as ArtisanProfile;
    }

    if (data.userId || data.profession !== undefined || data.skills || data.bio !== undefined) {
      addLog('[ExtractArtisan] Found artisan directly in data');
      return data as ArtisanProfile;
    }

    addLog(`[ExtractArtisan] Could not find artisan. Keys: ${Object.keys(data).join(', ')}`);
    return null;
  }, []);

  // ==========================================
  // FIXED: initAuth — Handles nested backend response { data: { user, ... } }
  // ==========================================
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

        addLog(`[Init] SUCCESS! Response: ${JSON.stringify(response.data).substring(0, 150)}...`);

        // FIXED: Handle nested backend response { data: { user, hasProfile, artisanProfile } }
        const res = response.data as any;
        const data = res.data || res;
        const user = data.user;
        const hasProfile = data.hasProfile;
        let artisanProfile = data.artisanProfile;

        if (!user) {
          throw new Error('No user data in response');
        }

        addLog(`[Init] User: ${user.email}, Role: ${user.role}, hasProfile: ${hasProfile}`);
        addLog(`[Init] artisanProfile from getMe: ${artisanProfile ? 'EXISTS' : 'NULL'}`);

        localStorage.setItem('user', JSON.stringify(user));

        if (user.role === 'artisan' && hasProfile === false) {
          addLog('[Init] Artisan authenticated but needs profile setup');

          setState({
            user,
            token,
            artisanProfile: null,
            isAuthenticated: true,
            isLoading: false,
            isInitialized: true,
          });

          connectSocket(user._id, token);

          if (!location.pathname.includes('/setup') && !location.pathname.includes('/profile')) {
            addLog('[Init] Redirecting to profile setup');
            navigate('/setup-profile', { replace: true });
          } else {
            addLog('[Init] Already on setup/profile page, no redirect needed');
          }

          addLog('[Init] === AUTH INITIALIZATION COMPLETE (needs profile) ===');
          return;
        }

        let finalArtisanProfile: ArtisanProfile | null = artisanProfile || null;

        if (user.role === 'artisan' && !finalArtisanProfile && hasProfile !== false) {
          addLog('[Init] User is artisan, hasProfile is not false, fetching /artisans/me...');
          try {
            const artisanRes = await artisanApi.getMyProfile();
            finalArtisanProfile = extractArtisanFromResponse(artisanRes);

            if (finalArtisanProfile) {
              addLog('[Init] Artisan profile loaded from /artisans/me');
            }
          } catch (err: any) {
            if (err.response?.status === 404) {
              addLog('[Init] /artisans/me returned 404 — profile may not exist');
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
  }, [connectSocket, disconnectSocket, getToken, clearTokens, extractArtisanFromResponse, navigate, location.pathname]);

  const extractErrorMessage = useCallback((err: any): string => {
    if (err?.response?.data?.error?.message) {
      return err.response.data.error.message;
    }

    if (err?.response?.data?.error?.code) {
      const code = err.response.data.error.code;
      const codeMap: Record<string, string> = {
        'AUTH_INVALID_CREDENTIALS': 'Email or password is incorrect',
        'AUTH_ACCOUNT_LOCKED': 'Account temporarily locked. Try again later',
        'AUTH_EMAIL_NOT_VERIFIED': 'Please verify your email before logging in',
        'AUTH_TOO_MANY_ATTEMPTS': 'Too many attempts. Please try again later',
        'AUTH_TOKEN_EXPIRED': 'Session expired. Please log in again.',
        'AUTH_UNAUTHORIZED': 'Access denied. Please log in again.',
        'USER_EXISTS': 'An account with this email already exists',
        'USER_PHONE_EXISTS': 'This phone number is already registered',
      };
      const mapped = codeMap[code];
      if (mapped) return mapped;
    }

    if (err?.response?.status === 401) {
      return 'Email or password is incorrect';
    }

    if (err?.message && !err.message.toLowerCase().includes('refresh token')) {
      return err.message;
    }

    return 'Login failed. Please try again.';
  }, []);

  // ==========================================
  // FIXED: login — Handles nested backend response { data: { user, accessToken, refreshToken } }
  // ==========================================
  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean = true) => {
      try {
        isLoggingIn.current = true;
        setState((prev) => ({ ...prev, isLoading: true }));

        addLog(`[Login] Starting login for: ${email}`);

        const response = await authApi.login({ email, password }, rememberMe);
        const res = response.data;

        // FIXED: Backend sends nested structure: { success, message, data: { user, accessToken, refreshToken, dashboardRoute } }
        const data = res.data || res;
        const user = data.user;
        const accessToken = data.accessToken || data.token;
        const refreshToken = data.refreshToken;
        const dashboardRoute = data.dashboardRoute || '/';

        if (!accessToken) {
          throw new Error('No access token received from server');
        }

        if (!user) {
          throw new Error('No user data received from server');
        }

        storeToken(accessToken, rememberMe);
        if (refreshToken) {
          storeRefreshToken(refreshToken, rememberMe);
        }
        localStorage.setItem('user', JSON.stringify(user));

        let finalArtisanProfile: ArtisanProfile | null = null;
        let needsProfileSetup = false;

        if (user.role === 'artisan') {
          addLog('[Login] User is artisan, fetching /artisans/me...');
          try {
            const artisanRes = await artisanApi.getMyProfile();
            finalArtisanProfile = extractArtisanFromResponse(artisanRes);

            if (finalArtisanProfile) {
              addLog('[Login] Artisan profile loaded successfully');
            }
          } catch (err: any) {
            if (err.response?.status === 404) {
              addLog('[Login] Artisan profile not found (404) — needs setup');
              needsProfileSetup = true;
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

        await new Promise(r => setTimeout(r, 500));

        addLog('[Login] Navigating now...');
        isLoggingIn.current = false;

        if (needsProfileSetup) {
          addLog('[Login] Redirecting to profile setup');
          navigate('/setup-profile', { replace: true });
        } else {
          const destination = location.state?.from?.pathname || dashboardRoute || '/';
          addLog(`[Login] Destination: ${destination}`);
          navigate(destination, { replace: true });
        }

      } catch (err: any) {
        const message = extractErrorMessage(err);
        isLoggingIn.current = false;
        setState((prev) => ({ 
          ...prev, 
          isLoading: false,
          isInitialized: true,  // FIXED: Ensure initialized even on error
        }));
        toast.error(message);
        throw new Error(message);
      }
    },
    [connectSocket, navigate, location.state, storeToken, storeRefreshToken, extractErrorMessage, extractArtisanFromResponse]
  );

  // ==========================================
  // FIXED: register — Handles nested backend response + artisan profile check
  // ==========================================
  const register = useCallback(
    async (data: RegisterData, rememberMe: boolean = true) => {
      try {
        isLoggingIn.current = true;
        setState((prev) => ({ ...prev, isLoading: true }));

        const response = await authApi.register(data, rememberMe);
        const res = response.data;

        // FIXED: Backend sends nested structure: { success, message, data: { user, accessToken, refreshToken, dashboardRoute } }
        const responseData = res.data || res;
        const user = responseData.user;
        const accessToken = responseData.accessToken || responseData.token;
        const refreshToken = responseData.refreshToken;
        const dashboardRoute = responseData.dashboardRoute || '/';

        if (!accessToken) {
          throw new Error('No access token received from server');
        }

        if (!user) {
          throw new Error('No user data received from server');
        }

        storeToken(accessToken, rememberMe);
        if (refreshToken) {
          storeRefreshToken(refreshToken, rememberMe);
        }
        localStorage.setItem('user', JSON.stringify(user));

        // FIXED: Check artisan profile for new registrations too
        let finalArtisanProfile: ArtisanProfile | null = null;
        let needsProfileSetup = false;

        if (user.role === 'artisan') {
          addLog('[Register] User is artisan, fetching /artisans/me...');
          try {
            const artisanRes = await artisanApi.getMyProfile();
            finalArtisanProfile = extractArtisanFromResponse(artisanRes);

            if (finalArtisanProfile) {
              addLog('[Register] Artisan profile loaded successfully');
            }
          } catch (err: any) {
            if (err.response?.status === 404) {
              addLog('[Register] Artisan profile not found (404) — needs setup');
              needsProfileSetup = true;
            } else {
              addLog(`[Register] Failed to load artisan profile: ${err.message}`);
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
        toast.success("Registration successful");

        isLoggingIn.current = false;

        // FIXED: Redirect to profile setup for artisans without profile
        if (needsProfileSetup) {
          addLog('[Register] Redirecting to profile setup');
          navigate('/setup-profile', { replace: true });
        } else {
          const destination = dashboardRoute || '/';
          navigate(destination, { replace: true });
        }

      } catch (err: any) {
        const message = extractErrorMessage(err);
        isLoggingIn.current = false;
        setState((prev) => ({ 
          ...prev, 
          isLoading: false,
          isInitialized: true,  // FIXED: Ensure initialized even on error
        }));
        toast.error(message);
        throw new Error(message);
      }
    },
    [connectSocket, navigate, storeToken, storeRefreshToken, extractErrorMessage, extractArtisanFromResponse]
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.log('Logout API failed:', err);
    }

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

    navigate("/login", { replace: true });
    toast.success("Logged out successfully");
  }, [disconnectSocket, navigate, clearTokens]);

  // FIXED: Accept refreshToken parameter
  const updateUserFromOAuth = useCallback((user: User, token: string, refreshToken?: string) => {
    addLog(`[OAuth] Updating user from OAuth: ${user.email}`);

    localStorage.setItem('token', token);
    localStorage.setItem('rememberMe', 'true');
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    localStorage.setItem('user', JSON.stringify(user));

    setState({
      user,
      token,
      artisanProfile: null,
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
    });

    connectSocket(user._id, token);
  }, [connectSocket]);

  // ==========================================
  // FIXED: refreshUser — Handles nested backend response
  // ==========================================
  const refreshUser = useCallback(async () => {
    try {
      addLog('[RefreshUser] Refreshing...');
      const response = await userApi.getMe();
      const res = response.data;

      // FIXED: Handle nested response
      const data = res.data || res;
      const user = data.user;
      const artisanProfile = data.artisanProfile;
      const hasProfile = data.hasProfile;

      let finalArtisanProfile: ArtisanProfile | null = artisanProfile || null;

      if (user.role === 'artisan' && !finalArtisanProfile && hasProfile !== false) {
        addLog('[RefreshUser] Fetching /artisans/me...');
        try {
          const artisanRes = await artisanApi.getMyProfile();
          finalArtisanProfile = extractArtisanFromResponse(artisanRes);
        } catch (err: any) {
          if (err.response?.status === 404) {
            addLog('[RefreshUser] Artisan profile not found (404)');
          } else {
            addLog(`[RefreshUser] Failed: ${err.message}`);
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
      localStorage.setItem('user', JSON.stringify(user));
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