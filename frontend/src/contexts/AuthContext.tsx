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

const isDev = import.meta.env.Dev;

const debugLogs: string[] = [];
const addLog = (msg: string) => {
  if (!isDev) return;
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  debugLogs.push(line);
  console.log(line);
  if (debugLogs.length > 100) debugLogs.shift();
};

if (typeof window !== 'undefined') {
  (window as any).getAuthLogs = () => {
    if (isDev) {
      console.log('=== AUTH CONTEXT LOGS ===\n' + debugLogs.join('\n'));
    }
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
  setUser: (user: User) => void;
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

    const socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: { userId, token: currentToken },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 30000,
      forceNew: true,
      autoConnect: true,
    });

    socketInstance.on("connect", () => {
      addLog('[Socket] Connected');
      setSocketConnected(true);
      socketInstance.emit("join_personal", { userId });
    });

    socketInstance.on("disconnect", (reason) => {
      addLog(`[Socket] Disconnected: ${reason}`);
      setSocketConnected(false);
      if (reason === 'io server disconnect') {
        setTimeout(() => socketInstance.connect(), 2000);
      }
    });

    socketInstance.on("connect_error", (err) => {
      addLog(`[Socket] Error: ${err.message}`);
      if (err.message.includes('jwt expired') || err.message.includes('AUTH_TOKEN_REQUIRED')) {
        disconnectSocket();
        clearTokens();
        setState({ user: null, token: null, artisanProfile: null, isAuthenticated: false, isLoading: false, isInitialized: true });
        navigate('/login');
        toast.error('Session expired. Please log in again.');
      }
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);
  }, [disconnectSocket, SOCKET_URL, navigate, clearTokens]);

  const extractArtisanFromResponse = useCallback((response: any): ArtisanProfile | null => {
    if (!response?.data?.data) return null;
    const data = response.data.data;
    if (data.artisanProfile) return data.artisanProfile;
    if (data.artisan) return data.artisan;
    if (data.userId || data.profession !== undefined || data.skills || data.bio !== undefined) return data;
    return null;
  }, []);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initAuth = async () => {
      if (isLoggingIn.current) return;

      try {
        addLog('[Init] Starting auth initialization');
        setState((prev) => ({ ...prev, isLoading: true }));

        const token = getToken();
        addLog(`[Init] Stored token: ${token ? 'YES' : 'NO'}`);

        addLog('[Init] Calling /auth/me...');
        const response = await userApi.getMe();

        const res = response.data as any;
        const user = res.user || res.data?.user;
        const hasProfile = res.hasProfile || res.data?.hasProfile;
        let artisanProfile = res.artisanProfile || res.data?.artisanProfile;

        if (!user) {
          throw new Error('No user data in response');
        }

        addLog(`[Init] Authenticated: ${user.email}`);

        if (token) storeToken(token, true);
        localStorage.setItem('user', JSON.stringify(user));

        if (user.role === 'artisan' && hasProfile === false) {
          setState({ user, token, artisanProfile: null, isAuthenticated: true, isLoading: false, isInitialized: true });
          connectSocket(user._id, token || '');
          if (!location.pathname.includes('/setup') && !location.pathname.includes('/profile')) {
            navigate('/setup-profile', { replace: true });
          }
          return;
        }

        let finalArtisanProfile: ArtisanProfile | null = artisanProfile || null;
        if (user.role === 'artisan' && !finalArtisanProfile && hasProfile !== false) {
          try {
            const artisanRes = await artisanApi.getMyProfile();
            finalArtisanProfile = extractArtisanFromResponse(artisanRes);
          } catch (err: any) {
            if (err.response?.status !== 404) addLog(`[Init] Artisan fetch error: ${err.message}`);
          }
        }

        setState({ user, token, artisanProfile: finalArtisanProfile, isAuthenticated: true, isLoading: false, isInitialized: true });
        connectSocket(user._id, token || '');
        addLog('[Init] Complete');

      } catch (error: any) {
        addLog(`[Init] Failed: ${error.response?.status || error.message}`);

        if (error.response?.status === 401) {
          addLog('[Init] 401 — clearing tokens');
          clearTokens();
        }

        setState({ user: null, token: null, artisanProfile: null, isAuthenticated: false, isLoading: false, isInitialized: true });
      }
    };

    const timer = setTimeout(initAuth, 100);
    return () => { clearTimeout(timer); disconnectSocket(); };
  }, [connectSocket, disconnectSocket, getToken, clearTokens, extractArtisanFromResponse, navigate, location.pathname, storeToken]);

  const extractErrorMessage = useCallback((err: any): string => {
    if (err?.response?.data?.error?.message) return err.response.data.error.message;
    if (err?.response?.data?.error?.code) {
      const codeMap: Record<string, string> = {
        'AUTH_INVALID_CREDENTIALS': 'Email or password is incorrect',
        'AUTH_USER_NOT_FOUND': 'No account found with this email',
        'AUTH_ACCOUNT_LOCKED': 'Account temporarily locked',
        'AUTH_EMAIL_NOT_VERIFIED': 'Please verify your email before logging in',
        'AUTH_TOO_MANY_ATTEMPTS': 'Too many attempts',
        'AUTH_TOKEN_EXPIRED': 'Session expired',
        'AUTH_UNAUTHORIZED': 'Access denied',
      };
      if (codeMap[err.response.data.error.code]) return codeMap[err.response.data.error.code];
    }
    if (err?.response?.status === 401) return 'Email or password is incorrect';
    return err?.message || 'Login failed. Please try again.';
  }, []);

  const login = useCallback(async (email: string, password: string, rememberMe: boolean = true) => {
    try {
      isLoggingIn.current = true;
      setState((prev) => ({ ...prev, isLoading: true }));
      addLog(`[Login] ${email}`);

      const response = await authApi.login({ email, password });
      const res = response.data.data || response.data;
      const user = res.user;
      const accessToken = res.accessToken || (res as any).token;
      const dashboardRoute = res.dashboardRoute || '/';

      if (!accessToken) throw new Error('No access token received');

      storeToken(accessToken, rememberMe);
      localStorage.setItem('user', JSON.stringify(user));

      let finalArtisanProfile: ArtisanProfile | null = null;
      let needsProfileSetup = false;

      if (user.role === 'artisan') {
        try {
          const artisanRes = await artisanApi.getMyProfile();
          finalArtisanProfile = extractArtisanFromResponse(artisanRes);
        } catch (err: any) {
          if (err.response?.status === 404) needsProfileSetup = true;
        }
      }

      setState({ user, token: accessToken, artisanProfile: finalArtisanProfile, isAuthenticated: true, isLoading: false, isInitialized: true });
      connectSocket(user._id, accessToken);
      toast.success(`Welcome ${user.fullName}`);
      await new Promise(r => setTimeout(r, 500));
      isLoggingIn.current = false;

      if (needsProfileSetup) {
        navigate('/setup-profile', { replace: true });
      } else {
        navigate(location.state?.from?.pathname || dashboardRoute || '/', { replace: true });
      }
    } catch (err: any) {
      isLoggingIn.current = false;
      setState((prev) => ({ ...prev, isLoading: false }));
      toast.error(extractErrorMessage(err));
      throw err;
    }
  }, [connectSocket, navigate, location.state, storeToken, extractErrorMessage, extractArtisanFromResponse]);

  const register = useCallback(async (data: RegisterData, rememberMe: boolean = true) => {
    try {
      isLoggingIn.current = true;
      setState((prev) => ({ ...prev, isLoading: true }));

      const response = await authApi.register(data);
      const res = response.data.data || response.data;
      const user = res.user;
      const accessToken = res.accessToken || (res as any).token;
      const dashboardRoute = res.dashboardRoute || '/';

      if (!accessToken) throw new Error('No access token received');

      storeToken(accessToken, rememberMe);
      localStorage.setItem('user', JSON.stringify(user));

      setState({ user, token: accessToken, artisanProfile: null, isAuthenticated: true, isLoading: false, isInitialized: true });
      connectSocket(user._id, accessToken);
      toast.success("Registration successful");

      isLoggingIn.current = false;
      navigate(dashboardRoute || '/', { replace: true });
    } catch (err: any) {
      isLoggingIn.current = false;
      setState((prev) => ({ ...prev, isLoading: false }));
      toast.error(extractErrorMessage(err));
      throw err;
    }
  }, [connectSocket, navigate, storeToken, extractErrorMessage]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch (e) {}
    disconnectSocket();
    clearTokens();
    setState({ user: null, token: null, artisanProfile: null, isAuthenticated: false, isLoading: false, isInitialized: true });
    navigate("/login", { replace: true });
    toast.success("Logged out successfully");
  }, [disconnectSocket, navigate, clearTokens]);

  const setUser = useCallback((user: User) => {
    addLog(`[Auth] setUser: ${user.email}`);
    localStorage.setItem('user', JSON.stringify(user));
    setState({
      user,
      token: null,
      artisanProfile: null,
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
    });
    connectSocket(user._id, '');
  }, [connectSocket]);

  // FIXED: now calls storeToken so the access token is persisted to
  // localStorage/sessionStorage — previously it only lived in React
  // state, so api.ts's request interceptor (which reads exclusively
  // from storage) never found it, and every request right after an
  // OAuth login went out with no Authorization header and got a 401.
  const updateUserFromOAuth = useCallback((user: User, token: string) => {
    addLog(`[OAuth] updateUserFromOAuth: ${user.email}`);
    storeToken(token, true);
    localStorage.setItem('rememberMe', 'true');
    localStorage.setItem('user', JSON.stringify(user));
    setState({ user, token, artisanProfile: null, isAuthenticated: true, isLoading: false, isInitialized: true });
    connectSocket(user._id, token);
  }, [connectSocket, storeToken]);

  const refreshUser = useCallback(async () => {
    try {
      addLog('[RefreshUser] Refreshing...');
      const response = await userApi.getMe();
      const res = response.data;
      const user = res.user || res.data?.user;
      const artisanProfile = res.artisanProfile || res.data?.artisanProfile;
      const hasProfile = res.hasProfile || res.data?.hasProfile;

      let finalArtisanProfile: ArtisanProfile | null = artisanProfile || null;
      if (user.role === 'artisan' && !finalArtisanProfile && hasProfile !== false) {
        try {
          const artisanRes = await artisanApi.getMyProfile();
          finalArtisanProfile = extractArtisanFromResponse(artisanRes);
        } catch (err: any) {
          if (err.response?.status !== 404) addLog(`[RefreshUser] Error: ${err.message}`);
        }
      }

      setState((prev) => ({ ...prev, user, artisanProfile: finalArtisanProfile, isAuthenticated: true }));
      localStorage.setItem('user', JSON.stringify(user));
    } catch (error: any) {
      if (error.response?.status === 401) {
        clearTokens();
        setState({ user: null, token: null, artisanProfile: null, isAuthenticated: false, isLoading: false, isInitialized: true });
        navigate('/login');
      }
    }
  }, [navigate, clearTokens, extractArtisanFromResponse]);

  const updateUser = useCallback((data: Partial<User>) => {
    setState((prev) => ({ ...prev, user: prev.user ? { ...prev.user, ...data } : null }));
  }, []);

  const updateArtisanProfile = useCallback((data: Partial<ArtisanProfile>) => {
    setState((prev) => ({ ...prev, artisanProfile: prev.artisanProfile ? { ...prev.artisanProfile, ...data } : null }));
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    setUser,
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