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
  hasProfile?: boolean;
  dashboardRoute?: string;
  accessToken?: string;
  token?: string;
  refreshToken?: string;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  token?: string;
  refreshToken?: string;
  user?: User;
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
  updateUserFromOAuth: (user: User, token: string) => void;
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
  // FIXED: initAuth — Handles flat backend response
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

        // ✅ FIXED: Handle flat backend response { user, token, ... }
        const res = response.data;
        const user = res.user || res.data?.user;
        const hasProfile = res.hasProfile || res.data?.hasProfile;
        let artisanProfile = res.artisanProfile || res.data?.artisanProfile;

        if (!user) {
          throw new Error('No user data in response');
        }

        addLog(`[Init] User: ${user.email}, Role: ${user.role}, hasProfile: ${hasProfile}`);
        addLog(`[Init] artisanProfile from getMe: ${artisanProfile ? 'EXISTS' : 'NULL'}`);

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
        'AUTH_USER_NOT_FOUND': 'No account found with this email',
        'AUTH_ACCOUNT_LOCKED': 'Account temporarily locked. Try again later',
        'AUTH_EMAIL_NOT_VERIFIED': 'Please verify your email before logging in',
        'AUTH_TOO_MANY_ATTEMPTS': 'Too many attempts. Please try again later',
        'AUTH_TOKEN_EXPIRED': 'Session expired. Please log in again.',
        'AUTH_UNAUTHORIZED': 'Access denied. Please log in again.',
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
  // FIXED: login — Handles flat backend response
  // ==========================================
  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean = true) => {
      try {
        isLoggingIn.current = true;
        setState((prev) => ({ ...prev, isLoading: true }));

        addLog(`[Login] Starting login for: ${email}`);

        const response = await authApi.login({ email, password });
        const res = response.data;

        // ✅ FIXED: Backend sends flat structure: { success, message, token, refreshToken, user }
        const user = res.user;
        const accessToken = res.token || res.accessToken;
        const dashboardRoute = res.dashboardRoute || '/';

        if (!accessToken) {
          throw new Error('No access token received from server');
        }

        storeToken(accessToken, rememberMe);

        let finalArtisanProfile: ArtisanProfile | null = null;
        let needsProfileSetup = false;

        if (user.role === 'artisan') {
          addLog('[Login] User is artisan but no profile in login response, fetching /artisans/me...');
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
        setState((prev) => ({ ...prev, isLoading: false }));
        toast.error(message);
        throw new Error(message);
      }
    },
    [connectSocket, navigate, location.state, storeToken, getToken, extractErrorMessage, extractArtisanFromResponse]
  );

  // ==========================================
  // FIXED: register — Handles flat backend response
  // ==========================================
  const register = useCallback(
    async (data: RegisterData, rememberMe: boolean = true) => {
      try {
        isLoggingIn.current = true;
        setState((prev) => ({ ...prev, isLoading: true }));

        const response = await authApi.register(data);
        const res = response.data;

        // ✅ FIXED: Backend sends flat structure: { success, message, token, refreshToken, user }
        const user = res.user;
        const accessToken = res.token || res.accessToken;
        const dashboardRoute = res.dashboardRoute || '/';

        if (!accessToken) {
          throw new Error('No access token received from server');
        }

        storeToken(accessToken, rememberMe);

        setState({
          user,
          token: accessToken,
          artisanProfile: null,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id, accessToken);
        toast.success("Registration successful");

        const destination = dashboardRoute || '/';
        isLoggingIn.current = false;
        navigate(destination, { replace: true });

      } catch (err: any) {
        const message = extractErrorMessage(err);
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
  }, [connectSocket]);

  // ==========================================
  // FIXED: refreshUser — Handles flat backend response
  // ==========================================
  const refreshUser = useCallback(async () => {
    try {
      addLog('[RefreshUser] Refreshing...');
      const response = await userApi.getMe();
      const res = response.data;

      // ✅ FIXED: Handle flat response
      const user = res.user || res.data?.user;
      const artisanProfile = res.artisanProfile || res.data?.artisanProfile;
      const hasProfile = res.hasProfile || res.data?.hasProfile;

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