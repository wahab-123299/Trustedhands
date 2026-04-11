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
// API CONFIG
// ==========================================

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000/api";
const SOCKET_URL = API_URL.replace("/api", "");

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
  
  // Track if we've already initialized to prevent double calls
  const hasInitialized = useRef(false);

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

  const connectSocket = useCallback(
    (userId: string) => {
      if (socketRef.current?.connected) return;

      disconnectSocket();

      const socketInstance = io(SOCKET_URL, {
        withCredentials: true,
        transports: ["websocket"],
        auth: { userId },
      });

      socketInstance.on("connect", () => {
        setSocketConnected(true);
        socketInstance.emit("join_personal", { userId });
      });

      socketInstance.on("disconnect", () => {
        setSocketConnected(false);
      });

      socketInstance.on("connect_error", () => {
        if (!socketConnected) {
          toast.error("Real-time connection failed");
        }
      });

      socketRef.current = socketInstance;
      setSocket(socketInstance);
    },
    [disconnectSocket, socketConnected]
  );

  // ==========================================
  // INIT AUTH - NO INFINITE LOOP
  // ==========================================

  useEffect(() => {
    // Prevent double initialization in React StrictMode
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const initAuth = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));
        
        console.log('🔄 Validating session with /users/me...');
        const response = await userApi.getMe();
        const res = response.data as ApiResponse<AuthResponseData>;

        const { user, artisanProfile } = res.data;

        console.log('✅ Session valid, user:', user.email);
        
        setState({
          user,
          artisanProfile: artisanProfile || null,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id);
      } catch (error: any) {
        console.error('❌ Session validation failed:', error.message);
        
        // Set state to not authenticated but MARK AS INITIALIZED
        // This prevents infinite loading/retry loops
        setState({
          user: null,
          artisanProfile: null,
          isAuthenticated: false,
          isLoading: false,
          isInitialized: true,
        });
        
        // Clear invalid token
        localStorage.removeItem('token');
      }
    };

    initAuth();

    return () => disconnectSocket();
  }, [connectSocket, disconnectSocket]);

  // ==========================================
  // LOGIN
  // ==========================================

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        console.log('🔑 Attempting login...');
        const response = await authApi.login({ email, password });
        const res = response.data as ApiResponse<AuthResponseData>;

        const { user, artisanProfile, dashboardRoute, accessToken } = res.data;

        console.log('✅ Login successful, token received:', !!accessToken);

        if (accessToken) {
          localStorage.setItem('token', accessToken);
        }

        setState({
          user,
          artisanProfile: artisanProfile || null,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id);

        toast.success(`Welcome ${user.fullName}`);

        setTimeout(() => {
          navigate(
            location.state?.from?.pathname || dashboardRoute || "/",
            { replace: true }
          );
        }, 100);

      } catch (err: any) {
        console.error('❌ Login failed:', err.message);
        setState((prev) => ({ ...prev, isLoading: false }));
        toast.error(err?.message || "Login failed");
        throw err;
      }
    },
    [connectSocket, navigate, location.state]
  );

  // ==========================================
  // REGISTER
  // ==========================================

  const register = useCallback(
    async (data: RegisterData) => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));

        console.log('📝 Attempting registration...');
        const response = await authApi.register(data);
        const res = response.data as ApiResponse<AuthResponseData>;

        const { user, artisanProfile, dashboardRoute, accessToken } = res.data;

        console.log('✅ Registration successful, token received:', !!accessToken);

        if (accessToken) {
          localStorage.setItem('token', accessToken);
        }

        setState({
          user,
          artisanProfile: artisanProfile || null,
          isAuthenticated: true,
          isLoading: false,
          isInitialized: true,
        });

        connectSocket(user._id);

        toast.success("Registration successful");

        setTimeout(() => {
          navigate(dashboardRoute || "/", { replace: true });
        }, 100);

      } catch (err: any) {
        console.error('❌ Registration failed:', err.message);
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
      console.log('Logout API call failed (ignoring):', err);
    }

    disconnectSocket();
    
    console.log('🚪 Logging out, clearing token...');
    localStorage.removeItem('token');

    setState({
      user: null,
      artisanProfile: null,
      isAuthenticated: false,
      isLoading: false,
      isInitialized: true,
    });

    navigate("/", { replace: true });
  }, [disconnectSocket, navigate]);

  // ==========================================
  // HELPERS
  // ==========================================

  const refreshUser = useCallback(async () => {
    const response = await userApi.getMe();
    const res = response.data as ApiResponse<AuthResponseData>;

    const { user, artisanProfile } = res.data;

    setState((prev) => ({
      ...prev,
      user,
      artisanProfile: artisanProfile || null,
      isAuthenticated: true,
    }));
  }, []);

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