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
import { authApi, userApi, RegisterData } from "@/services/api";
import { User, ArtisanProfile } from "@/types";

// Store logs for debugging
const debugLogs: string[] = [];
const addLog = (msg: string) => {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  debugLogs.push(line);
  console.log(line);
  if (debugLogs.length > 100) debugLogs.shift();
};

// Expose to window
if (typeof window !== 'undefined') {
  (window as any).getAuthLogs = () => {
    console.log('=== AUTH CONTEXT LOGS ===\n' + debugLogs.join('\n'));
    return debugLogs;
  };
  (window as any).clearAuthLogs = () => {
    debugLogs.length = 0;
  };
}

// ==========================================
// TYPES
// ==========================================

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
  updateUserFromOAuth: (user: User, token: string) => void; // ✅ ADDED
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

// ==========================================
// CONTEXT
// ==========================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ==========================================
// PROVIDER
// ==========================================

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

  // ==========================================
  // TOKEN STORAGE HELPERS (Remember Me Support)
  // ==========================================

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

  // ==========================================
  // SOCKET - FIXED WITH TOKEN & RECONNECTION
  // ==========================================

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
      transports: ["polling", "websocket"],
      auth: { 
        userId,
        token: currentToken
      },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketInstance.on("connect", () => {
      addLog('[Socket] Connected successfully');
      setSocketConnected(true);
      socketInstance.emit("join_personal", { userId });
    });

    socketInstance.on("disconnect", (reason) => {
      addLog(`[Socket] Disconnected: ${reason}`);
      setSocketConnected(false);
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

    socketRef.current = socketInstance;
    setSocket(socketInstance);
  }, [disconnectSocket, SOCKET_URL, navigate, clearTokens]);

  // ==========================================
  // INIT AUTH
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
        
        addLog(`[Init] SUCCESS! Response: ${JSON.stringify(response.data).substring(0, 100)}...`);
        const res = response.data as ApiResponse<AuthResponseData>;
        const { user, artisanProfile } = res.data;

        addLog(`[Init] User: ${user.email}, Role: ${user.role}`);

        setState({
          user,
          token,
          artisanProfile: artisanProfile || null,
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
  }, [connectSocket, disconnectSocket, getToken, clearTokens]);

  // ==========================================
  // LOGIN - WITH REMEMBER ME SUPPORT
  // ==========================================

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

        setState({
          user,
          token: accessToken,
          artisanProfile: artisanProfile || null,
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
        addLog(`[Login] FAILED: ${err.message}`);
        addLog(`[Login] Error response: ${JSON.stringify(err.response?.data)}`);
        isLoggingIn.current = false;
        setState((prev) => ({ ...prev, isLoading: false }));
        toast.error(err?.message || "Login failed");
        throw err;
      }
    },
    [connectSocket, navigate, location.state, storeToken, getToken]
  );

  // ==========================================
  // REGISTER - WITH REMEMBER ME SUPPORT
  // ==========================================

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
        addLog(`[Register] FAILED: ${err.message}`);
        addLog(`[Register] Error response: ${JSON.stringify(err.response?.data)}`);
        isLoggingIn.current = false;
        setState((prev) => ({ ...prev, isLoading: false }));
        toast.error(err?.message || "Registration failed");
        throw err;
      }
    },
    [connectSocket, navigate, storeToken]
  );

  // ==========================================
  // LOGOUT
  // ==========================================

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

  // ==========================================
  // UPDATE USER FROM OAUTH (NEW - FOR GOOGLE/FACEBOOK LOGIN)
  // ==========================================

  const updateUserFromOAuth = useCallback((user: User, token: string) => {
    addLog(`[OAuth] Updating user from OAuth: ${user.email}`);
    
    // Store token in localStorage (OAuth always uses remember me)
    localStorage.setItem('token', token);
    localStorage.setItem('rememberMe', 'true');
    
    setState({
      user,
      token,
      artisanProfile: null, // OAuth users need to complete artisan profile separately
      isAuthenticated: true,
      isLoading: false,
      isInitialized: true,
    });
    
    connectSocket(user._id, token);
    addLog('[OAuth] User updated and socket connected');
  }, [connectSocket]);

  // ==========================================
  // HELPERS
  // ==========================================

  const refreshUser = useCallback(async () => {
    try {
      addLog('[RefreshUser] Refreshing...');
      const response = await userApi.getMe();
      const res = response.data as ApiResponse<AuthResponseData>;
      const { user, artisanProfile } = res.data;

      setState((prev) => ({
        ...prev,
        user,
        artisanProfile: artisanProfile || null,
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
  }, [navigate, clearTokens]);

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

  // ==========================================
  // VALUE
  // ==========================================

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    updateArtisanProfile,
    refreshUser,
    updateUserFromOAuth, // ✅ ADDED
    socket,
    socketConnected,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ==========================================
// HOOK
// ==========================================

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
};

export default AuthContext;