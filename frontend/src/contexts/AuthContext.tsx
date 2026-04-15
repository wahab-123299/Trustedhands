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
  artisanProfile: ArtisanProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  updateArtisanProfile: (data: Partial<ArtisanProfile>) => void;
  refreshUser: () => Promise<void>;
  socket: Socket | null;
  socketConnected: boolean;
}

interface AuthState {
  user: User | null;
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
  // SOCKET
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

  const connectSocket = useCallback((userId: string) => {
    if (socketRef.current?.connected) return;
    disconnectSocket();

    console.log('[Socket] Connecting to:', SOCKET_URL);

    const socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: { userId },
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect", () => {
      console.log('[Socket] Connected');
      setSocketConnected(true);
      socketInstance.emit("join_personal", { userId });
    });

    socketInstance.on("disconnect", () => {
      console.log('[Socket] Disconnected');
      setSocketConnected(false);
    });

    socketInstance.on("connect_error", (err) => {
      console.error('[Socket] Connection error:', err.message);
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);
  }, [disconnectSocket, SOCKET_URL]);

  // ==========================================
  // INIT AUTH - FIXED WITH DEBUGGING
  // ==========================================

  useEffect(() => {
    if (hasInitialized.current) {
      console.log('[Init] Already initialized, skipping');
      return;
    }
    hasInitialized.current = true;

    const initAuth = async () => {
      if (isLoggingIn.current) {
        console.log('[Init] Login in progress, skipping init');
        return;
      }
      
      try {
        console.log('[Init] Starting auth initialization...');
        setState((prev) => ({ ...prev, isLoading: true }));
        
        const token = localStorage.getItem('token');
        console.log('[Init] Token from localStorage:', token ? 'EXISTS (' + token.substring(0, 20) + '...)' : 'NULL');
        
        if (!token) {
          console.log('[Init] No token, setting unauthenticated');
          setState({
            user: null,
            artisanProfile: null,
            isAuthenticated: false,
            isLoading: false,
            isInitialized: true,
          });
          return;
        }
        
        // Validate token by fetching user
        console.log('[Init] Calling userApi.getMe()...');
        const response = await userApi.getMe();
        console.log('[Init] userApi.getMe() response:', response.data);
        
        const res = response.data as ApiResponse<AuthResponseData>;
        const { user, artisanProfile } = res.data;

        console.log('[Init] Token valid, user:', user.email);

        setState({
          user,
          artisanProfile: artisanProfile || null,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id);
      } catch (error: any) {
        console.error('[Init] FAILED:', error.message);
        console.error('[Init] Error response:', error.response?.data);
        console.error('[Init] Error status:', error.response?.status);
        
        // Only clear token on 401, not on network errors
        if (error.response?.status === 401) {
          console.log('[Init] Clearing invalid token (401)');
          localStorage.removeItem('token');
        } else {
          console.log('[Init] Not clearing token (not 401)');
        }
        
        setState({
          user: null,
          artisanProfile: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
        });
      }
    };

    // Small delay to let React hydrate
    const timer = setTimeout(initAuth, 100);
    
    return () => {
      clearTimeout(timer);
      disconnectSocket();
    };
  }, [connectSocket, disconnectSocket]);

  // ==========================================
  // LOGIN - FIXED WITH DEBUGGING
  // ==========================================

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        isLoggingIn.current = true;
        setState((prev) => ({ ...prev, isLoading: true }));

        console.log('[Login] Starting login for:', email);
        
        const response = await authApi.login({ email, password });
        console.log('[Login] Response:', response.data);
        
        const res = response.data as ApiResponse<AuthResponseData>;

        const { user, artisanProfile, dashboardRoute, accessToken } = res.data;

        console.log('[Login] Success! Token received:', !!accessToken);
        if (accessToken) {
          console.log('[Login] Token length:', accessToken.length);
          console.log('[Login] Token preview:', accessToken.substring(0, 30) + '...');
        }

        if (!accessToken) {
          throw new Error('No access token received from server');
        }

        // Save token
        localStorage.setItem('token', accessToken);
        
        // Verify it was saved
        const savedToken = localStorage.getItem('token');
        console.log('[Login] Token saved to localStorage:', !!savedToken);
        console.log('[Login] Saved token matches:', savedToken === accessToken);

        // Update state
        setState({
          user,
          artisanProfile: artisanProfile || null,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id);
        toast.success(`Welcome ${user.fullName}`);

        // Navigate
        const destination = location.state?.from?.pathname || dashboardRoute || '/';
        console.log('[Login] Navigating to:', destination);
        
        isLoggingIn.current = false;
        navigate(destination, { replace: true });
        console.log('[Login] Navigation complete');

      } catch (err: any) {
        console.error('[Login] FAILED:', err.message);
        console.error('[Login] Error response:', err.response?.data);
        isLoggingIn.current = false;
        setState((prev) => ({ ...prev, isLoading: false }));
        toast.error(err?.message || "Login failed");
        throw err;
      }
    },
    [connectSocket, navigate, location.state]
  );

  // ==========================================
  // REGISTER - FIXED WITH DEBUGGING
  // ==========================================

  const register = useCallback(
    async (data: RegisterData) => {
      try {
        isLoggingIn.current = true;
        setState((prev) => ({ ...prev, isLoading: true }));

        console.log('[Register] Starting registration for:', data.email);
        
        const response = await authApi.register(data);
        console.log('[Register] Response:', response.data);
        
        const res = response.data as ApiResponse<AuthResponseData>;

        const { user, artisanProfile, dashboardRoute, accessToken } = res.data;

        console.log('[Register] Success! Token received:', !!accessToken);

        if (!accessToken) {
          throw new Error('No access token received from server');
        }

        localStorage.setItem('token', accessToken);
        console.log('[Register] Token saved');

        setState({
          user,
          artisanProfile: artisanProfile || null,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id);
        toast.success("Registration successful");

        const destination = dashboardRoute || '/';
        isLoggingIn.current = false;
        navigate(destination, { replace: true });

      } catch (err: any) {
        console.error('[Register] FAILED:', err.message);
        console.error('[Register] Error response:', err.response?.data);
        isLoggingIn.current = false;
        setState((prev) => ({ ...prev, isLoading: false }));
        toast.error(err?.message || "Registration failed");
        throw err;
      }
    },
    [connectSocket, navigate]
  );

  // ==========================================
  // LOGOUT
  // ==========================================

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.log('Logout API failed (ignoring):', err);
    }

    disconnectSocket();
    
    console.log('[Logout] Clearing token');
    localStorage.removeItem('token');

    setState({
      user: null,
      artisanProfile: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
    });

    navigate("/login", { replace: true });
    toast.success("Logged out successfully");
  }, [disconnectSocket, navigate]);

  // ==========================================
  // HELPERS
  // ==========================================

  const refreshUser = useCallback(async () => {
    try {
      console.log('[RefreshUser] Refreshing user data...');
      const response = await userApi.getMe();
      const res = response.data as ApiResponse<AuthResponseData>;
      const { user, artisanProfile } = res.data;

      setState((prev) => ({
        ...prev,
        user,
        artisanProfile: artisanProfile || null,
        isAuthenticated: true,
      }));
      console.log('[RefreshUser] Success');
    } catch (error: any) {
      console.error('[RefreshUser] Failed:', error.message);
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        setState({
          user: null,
          artisanProfile: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
        });
        navigate('/login');
      }
    }
  }, [navigate]);

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