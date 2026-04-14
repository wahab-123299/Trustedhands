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

    const socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      auth: { userId },
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
    });

    socketInstance.on("connect", () => {
      setSocketConnected(true);
      socketInstance.emit("join_personal", { userId });
    });

    socketInstance.on("disconnect", () => setSocketConnected(false));

    socketRef.current = socketInstance;
    setSocket(socketInstance);
  }, [disconnectSocket, SOCKET_URL]);

  // ==========================================
  // INIT AUTH - FIXED WITH BETTER DEBUGGING
  // ==========================================

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initAuth = async () => {
      if (isLoggingIn.current) return;
      
      try {
        setState((prev) => ({ ...prev, isLoading: true }));
        
        const token = localStorage.getItem('token');
        console.log('[AuthContext] Init - Token exists:', !!token);
        
        if (!token) {
          console.log('[AuthContext] No token, setting unauthenticated');
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
        console.log('[AuthContext] Validating token...');
        const response = await userApi.getMe();
        const res = response.data as ApiResponse<AuthResponseData>;

        const { user, artisanProfile } = res.data;
        console.log('[AuthContext] Token valid, user:', user.email);

        setState({
          user,
          artisanProfile: artisanProfile || null,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id);
      } catch (error: any) {
        console.error('[AuthContext] Init failed:', error.message);
        console.error('[AuthContext] Status:', error.response?.status);
        
        // Only clear token on 401, not on network errors
        if (error.response?.status === 401) {
          console.log('[AuthContext] Clearing invalid token');
          localStorage.removeItem('token');
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
  // LOGIN - FIXED
  // ==========================================

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        isLoggingIn.current = true;
        setState((prev) => ({ ...prev, isLoading: true }));

        console.log('[AuthContext] Logging in:', email);
        
        const response = await authApi.login({ email, password });
        const res = response.data as ApiResponse<AuthResponseData>;

        const { user, artisanProfile, dashboardRoute, accessToken } = res.data;

        if (!accessToken) {
          throw new Error('No access token received from server');
        }

        // Save token
        localStorage.setItem('token', accessToken);
        console.log('[AuthContext] Token saved, length:', accessToken.length);

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
        console.log('[AuthContext] Navigating to:', destination);
        
        isLoggingIn.current = false;
        navigate(destination, { replace: true });

      } catch (err: any) {
        console.error('[AuthContext] Login failed:', err.message);
        isLoggingIn.current = false;
        setState((prev) => ({ ...prev, isLoading: false }));
        toast.error(err?.message || "Login failed");
        throw err;
      }
    },
    [connectSocket, navigate, location.state]
  );

  // ==========================================
  // REGISTER - FIXED
  // ==========================================

  const register = useCallback(
    async (data: RegisterData) => {
      try {
        isLoggingIn.current = true;
        setState((prev) => ({ ...prev, isLoading: true }));

        console.log('[AuthContext] Registering:', data.email);
        
        const response = await authApi.register(data);
        const res = response.data as ApiResponse<AuthResponseData>;

        const { user, artisanProfile, dashboardRoute, accessToken } = res.data;

        if (!accessToken) {
          throw new Error('No access token received from server');
        }

        localStorage.setItem('token', accessToken);
        console.log('[AuthContext] Token saved after register');

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
        console.error('[AuthContext] Register failed:', err.message);
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
      const response = await userApi.getMe();
      const res = response.data as ApiResponse<AuthResponseData>;
      const { user, artisanProfile } = res.data;

      setState((prev) => ({
        ...prev,
        user,
        artisanProfile: artisanProfile || null,
        isAuthenticated: true,
      }));
    } catch (error: any) {
      console.error('[AuthContext] Refresh user failed:', error.message);
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