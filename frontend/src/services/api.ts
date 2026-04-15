import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';


// Store logs for debugging after redirect
const debugLogs: string[] = [];
const addLog = (msg: string) => {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  debugLogs.push(line);
  console.log(line);
  // Keep only last 50 logs
  if (debugLogs.length > 50) debugLogs.shift();
};

// Expose to window for inspection
if (typeof window !== 'undefined') {
  (window as any).getAuthLogs = () => {
    console.log('=== AUTH DEBUG LOGS ===\n' + debugLogs.join('\n'));
    return debugLogs;
  };
  (window as any).clearAuthLogs = () => {
    debugLogs.length = 0;
  };
}

const API_URL = import.meta.env.VITE_API_URL || 'https://trustedhands.onrender.com/api';
addLog(`[API Config] URL: ${API_URL}`);

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 60000, // ⬆️ Increased to 60s for Render cold starts
});

api.defaults.withCredentials = true;

// ==========================================
// REFRESH TOKEN STATE
// ==========================================
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];
let refreshPromise: Promise<string> | null = null;

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

// ==========================================
// REQUEST INTERCEPTOR
// ==========================================
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    if (token) {
      try {
        // Validate token isn't expired before using
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiryTime = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        
        // ✅ FIXED: Add 60-second buffer for clock skew
        // Don't clear token if it's just slightly expired (within 60s)
        // Let the server validate and return 401 if truly expired
        if (now >= expiryTime + 60000) { // 60 second grace period
          addLog(`[Request] Token truly expired (${Math.floor((now - expiryTime)/1000)}s past), clearing`);
          localStorage.removeItem('token');
          // Don't set header - let it fail and trigger refresh
        } else if (now >= expiryTime) {
          // Token appears expired but within grace period - still use it
          // Server will reject if truly invalid
          addLog(`[Request] Token appears expired but within grace period, using anyway`);
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          config.headers.Authorization = `Bearer ${token}`;
          const timeLeft = Math.floor((expiryTime - now) / 1000);
          addLog(`[Request] ${config.method?.toUpperCase()} ${config.url} - Token valid (${timeLeft}s left)`);
        }
      } catch (e) {
        // Invalid token format
        addLog(`[Request] Invalid token format, clearing`);
        localStorage.removeItem('token');
      }
    } else {
      addLog(`[Request] ${config.method?.toUpperCase()} ${config.url} - NO TOKEN`);
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ==========================================
// RESPONSE INTERCEPTOR - WITH RETRY LOGIC
// ==========================================
api.interceptors.response.use(
  (response: AxiosResponse) => {
    addLog(`[Response] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

    // Handle network errors (no response) - RENDER COLD START
    if (!error.response) {
      addLog(`[Response] Network error: ${error.message}`);
      
      // Retry network errors up to 2 times
      const retryCount = originalRequest._retryCount || 0;
      if (retryCount < 2 && error.code === 'ECONNABORTED') {
        addLog(`[Response] Retrying network error (${retryCount + 1}/2)...`);
        originalRequest._retryCount = retryCount + 1;
        
        // Wait 3 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 3000));
        return api(originalRequest);
      }
      
      return Promise.reject({
        ...error,
        message: 'Server is waking up. Please try again.',
        isWakeUpError: true,
      });
    }

    const { status, data } = error.response as any;
    const errorCode = data?.error?.code || data?.code;
    const errorMessage = data?.error?.message || data?.message || '';

    addLog(`[Response] ERROR ${status}: ${errorCode} - ${errorMessage}`);

    // Handle 401 - Try to refresh token
    if (status === 401) {
      addLog('[Response] Got 401, checking if we should refresh...');

      if (originalRequest._retry || originalRequest.url?.includes('/auth/refresh')) {
        addLog('[Response] Already retried or is refresh request - clearing token');
        localStorage.removeItem('token');
        addLog('[Response] Token cleared, NOT redirecting (let ProtectedRoute handle it)');
        return Promise.reject(error);
      }

      // If already refreshing, wait for it
      if (isRefreshing && refreshPromise) {
        addLog('[Response] Token refresh in progress, queuing request');
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      // Start refresh
      isRefreshing = true;
      originalRequest._retry = true;

      refreshPromise = (async () => {
        try {
          addLog('[Response] Calling /auth/refresh...');
          const response = await api.post('/auth/refresh');
          const { accessToken } = response.data.data || response.data;

          addLog(`[Response] Token refreshed: ${accessToken.substring(0, 15)}...`);
          localStorage.setItem('token', accessToken);
          onTokenRefreshed(accessToken);
          return accessToken;
        } catch (refreshError: any) {
          addLog(`[Response] Refresh failed: ${refreshError.message}`);
          localStorage.removeItem('token');
          throw refreshError;
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      })();

      try {
        const newToken = await refreshPromise;
        // Update header with new token before retry
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        addLog('[Response] Token cleared after failed refresh, NOT redirecting');
        return Promise.reject(refreshError);
      }
    }

    // Handle 403
    if (status === 403) {
      if (errorCode === 'AUTH_UNAUTHORIZED' || errorCode === 'AUTH_TOKEN_EXPIRED') {
        localStorage.removeItem('token');
        addLog('[Response] 403 - Token cleared');
      }
      
      return Promise.reject({
        ...error,
        message: errorMessage || 'Access denied.',
        code: errorCode || 'FORBIDDEN',
      });
    }

    return Promise.reject({
      ...error,
      message: errorMessage || 'An error occurred.',
      code: errorCode || 'UNKNOWN_ERROR',
    });
  }
);

// ==========================================
// SERVER WAKE-UP HELPER (for Render cold starts)
// ==========================================
export const wakeUpServer = async (): Promise<boolean> => {
  try {
    addLog('[WakeUp] Pinging server...');
    // Use a simple GET that doesn't require auth
    await axios.get(`${API_URL.replace('/api', '')}/health`, { 
      timeout: 10000,
      withCredentials: true 
    });
    addLog('[WakeUp] Server is awake');
    return true;
  } catch (error: any) {
    // Health endpoint might not exist, try root
    try {
      await axios.get(API_URL.replace('/api', ''), { 
        timeout: 10000,
        withCredentials: true 
      });
      addLog('[WakeUp] Server responded (root)');
      return true;
    } catch {
      addLog('[WakeUp] Server ping failed');
      return false;
    }
  }
};

// ==========================================
// API INTERFACES & EXPORTS
// ==========================================

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: 'customer' | 'artisan';
  location: {
    state: string;
    city: string;
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  skills?: string[];
  experienceYears?: string;
  rate?: {
    amount: number;
    period: 'hour' | 'day' | 'job';
  };
  bio?: string;
}

export const authApi = {
  login: (data: LoginData) => 
    api.post<ApiResponse<{ user: any; accessToken: string; dashboardRoute: string }>>('/auth/login', data),
  
  register: (data: RegisterData) => 
    api.post<ApiResponse<{ user: any; accessToken: string; dashboardRoute: string }>>('/auth/register', data),
  
  logout: () => 
    api.post<ApiResponse<void>>('/auth/logout'),
  
  refresh: () => 
    api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh'),
  
  verifyEmail: (token: string) => 
    api.post<ApiResponse<void>>(`/auth/verify-email/${token}`),
  
  resendVerification: (email: string) => 
    api.post<ApiResponse<void>>('/auth/resend-verification', { email }),
  
  forgotPassword: (email: string) => 
    api.post<ApiResponse<void>>('/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string) => 
    api.post<ApiResponse<void>>(`/auth/reset-password/${token}`, { password }),
};

export const userApi = {
  getMe: () => 
    api.get<ApiResponse<any>>('/users/me'),
  
  updateMe: (data: Partial<{ fullName: string; phone: string; location: any; profileImage: string }>) => 
    api.put<ApiResponse<any>>('/users/me', data),

  getArtisanById: (id: string) => api.get(`/artisans/${id}`),
  
  updateLocation: (data: { state: string; city: string; address?: string; coordinates?: { lat: number; lng: number } }) => 
    api.put<ApiResponse<any>>('/users/location', data),
  
  uploadProfileImage: (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    return api.put<ApiResponse<{ profileImage: string }>>('/users/profile-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  deleteMe: () => 
    api.delete<ApiResponse<void>>('/users/me'),
};

export interface ArtisanProfileUpdate {
  skills?: string[];
  experienceYears?: '0-1' | '1-3' | '3-5' | '5-10' | '10+';
  rate?: {
    amount: number;
    period: 'hour' | 'day' | 'job';
  };
  bio?: string;
  workRadius?: '5' | '10' | '20' | '50' | 'any';
  availability?: {
    status: 'available' | 'unavailable' | 'busy';
    nextAvailableDate?: string;
  };
}

export interface BankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankCode: string;
}

export const artisanApi = {
  getAll: (params?: { 
    state?: string; 
    city?: string; 
    skills?: string; 
    availability?: string; 
    minRating?: number;
    maxRate?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
  }) => 
    api.get<ApiResponse<{ artisans: any[]; pagination: any }>>('/artisans', { params }),
  
  search: (query: string, params?: { page?: number; limit?: number }) => 
    api.get<ApiResponse<{ artisans: any[]; pagination: any }>>('/artisans/search', { params: { q: query, ...params } }),
  
  getNearby: (lat: number, lng: number, radius?: number, params?: any) => 
    api.get<ApiResponse<{ artisans: any[]; pagination: any }>>('/artisans/nearby', { 
      params: { lat, lng, radius, ...params } 
    }),
  
  getById: (id: string) => 
    api.get<ApiResponse<{ artisan: any; reviews: any[] }>>(`/artisans/${id}`),
  
  getReviews: (id: string, params?: { page?: number; limit?: number }) => 
    api.get<ApiResponse<{ reviews: any[]; ratingStats: any[]; pagination: any }>>(`/artisans/${id}/reviews`, { params }),
  
  updateProfile: (data: ArtisanProfileUpdate) => 
    api.put<ApiResponse<{ artisan: any }>>('/artisans/profile', data),
  
  updateAvailability: (data: { status: 'available' | 'unavailable' | 'busy'; nextAvailableDate?: string }) => 
    api.put<ApiResponse<{ availability: any }>>('/artisans/availability', data),
  
  updateBankDetails: (data: BankDetails) => 
    api.put<ApiResponse<{ bankDetails: BankDetails }>>('/artisans/bank-details', data),
  
  uploadPortfolioImages: (files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('images', file));
    return api.put<ApiResponse<{ portfolioImages: string[] }>>('/artisans/portfolio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  
  deletePortfolioImage: (imageUrl: string) => 
    api.delete<ApiResponse<{ portfolioImages: string[] }>>('/artisans/portfolio', { data: { imageUrl } }),
};

export interface JobCreateData {
  title: string;
  description: string;
  category: string;
  location: {
    state: string;
    city: string;
    address?: string;
    coordinates?: { lat: number; lng: number };
  };
  budget: number;
  scheduledDate: string;
  artisanId?: string;
}

export interface ReviewData {
  rating: number;
  comment?: string;
}

export const jobApi = {
  create: (data: JobCreateData) => 
    api.post<ApiResponse<{ job: any }>>('/jobs', data),
  
  getMyJobs: (params?: { status?: string; page?: number; limit?: number }) => 
    api.get<ApiResponse<{ jobs: any[]; pagination: any }>>('/jobs/my-jobs', { params }),
  
  getById: (id: string) => 
    api.get<ApiResponse<{ job: any }>>(`/jobs/${id}`),

  getJobApplications: (jobId: string) => 
    api.get(`/jobs/${jobId}/applications`),
  
  accept: (id: string) => 
    api.put<ApiResponse<{ job: any }>>(`/jobs/${id}/accept`),

  acceptApplication: (applicationId: string) => 
    api.post(`/applications/${applicationId}/accept`),
  
  start: (id: string) => 
    api.put<ApiResponse<{ job: any }>>(`/jobs/${id}/start`),
  
  complete: (id: string) => 
    api.put<ApiResponse<{ job: any }>>(`/jobs/${id}/complete`),
  
  confirmCompletion: (id: string, data?: { rating?: number; comment?: string }) => 
    api.put<ApiResponse<{ job: any }>>(`/jobs/${id}/confirm-completion`, data),
  
  cancel: (id: string, reason?: string) => 
    api.put<ApiResponse<{ job: any }>>(`/jobs/${id}/cancel`, { reason }),

  rejectApplication: (applicationId: string) => 
    api.post(`/applications/${applicationId}/reject`),
  
  addReview: (id: string, data: ReviewData) => 
    api.post<ApiResponse<{ review: any }>>(`/jobs/${id}/review`, data),
  
  getAll: (params?: { status?: string; category?: string; page?: number; limit?: number }) => 
    api.get<ApiResponse<{ jobs: any[]; pagination: any }>>('/jobs', { params }),
  
  apply: (id: string, data?: { coverLetter?: string; proposedRate?: number }) => 
    api.post<ApiResponse<void>>(`/jobs/${id}/apply`, data),
};

export const applicationsApi = {
  getMyApplications: (params?: { status?: string; page?: number; limit?: number }) => 
    api.get<ApiResponse<{ applications: any[]; pagination: any }>>('/applications/my-applications', { params }),
  
  getApplicationById: (id: string) => 
    api.get<ApiResponse<{ application: any }>>(`/applications/${id}`),
  
  withdrawApplication: (id: string) => 
    api.put<ApiResponse<void>>(`/applications/${id}/withdraw`),
};

export interface PaymentInitializeData {
  jobId: string;
  email?: string;
  metadata?: Record<string, any>;
}

export const walletApi = {
  getBalance: () => api.get('/payments/wallet'),
  initializeDeposit: (amount: number) => api.post('/payments/initialize', { amount }),
  withdraw: (amount: number) => api.post('/payments/withdraw', { amount }),
  getTransactions: (params?: { page?: number; limit?: number }) => 
    api.get('/payments/history', { params }),
};

export const paymentApi = {
  initialize: (data: PaymentInitializeData) => 
    api.post<ApiResponse<{ authorization_url: string; reference: string; transactionId: string; amount: any }>>('/payments/initialize', data),
  
  verify: (reference: string) => 
    api.get<ApiResponse<{ transaction: any; paystackData: any }>>(`/payments/verify/${reference}`),
  
  verifyPayment: (reference: string) => 
    api.get(`/payments/verify/${reference}`),

  releasePayment: (jobId: string) => 
    api.put<ApiResponse<{ transaction: any; job: any }>>(`/payments/release/${jobId}`),
  
  getHistory: (params?: { type?: string; status?: string; page?: number; limit?: number }) => 
    api.get<ApiResponse<{ transactions: any[]; summary: any; pagination: any }>>('/payments/history', { params }),
  
  getWallet: () => 
    api.get<ApiResponse<{ wallet: any; isNew: boolean }>>('/payments/wallet'),
  
  requestWithdrawal: (amount: number) => 
    api.post<ApiResponse<{ transaction: any; withdrawal: any; wallet: any }>>('/payments/withdraw', { amount }),
  
  getBanks: () => 
    api.get<ApiResponse<{ banks: any[]; count: number }>>('/payments/banks'),
  
  verifyAccount: (data: { accountNumber: string; bankCode: string }) => 
    api.post<ApiResponse<{ accountNumber: string; accountName: string; bankCode: string }>>('/payments/verify-account', data),
};

export interface CreateConversationData {
  participantId: string;
  jobId?: string;
}

export const chatApi = {
  getConversations: () => 
    api.get<ApiResponse<{ conversations: any[] }>>('/chat/conversations'),
  
  getMessages: (conversationId: string, params?: { page?: number; limit?: number; before?: string }) => 
    api.get<ApiResponse<{ messages: any[]; pagination: any }>>(`/chat/conversations/${conversationId}/messages`, { params }),
  
  createConversation: (data: CreateConversationData) => 
    api.post<ApiResponse<{ conversation: any }>>('/chat/conversations', data),
  
  deleteConversation: (id: string) => 
    api.delete<ApiResponse<void>>(`/chat/conversations/${id}`),
  
  markAsRead: (conversationId: string) => 
    api.put<ApiResponse<void>>(`/chat/conversations/${conversationId}/read`),
};

export const handleApiError = (error: any): string => {
  if (error.response?.data?.error?.message) {
    return error.response.data.error.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred.';
};

export const getErrorCode = (error: any): string => {
  return error.response?.data?.error?.code || error.code || 'UNKNOWN_ERROR';
};

export { api };
export default api;