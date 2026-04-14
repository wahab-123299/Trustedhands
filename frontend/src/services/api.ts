import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'https://trustedhands.onrender.com/api';

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,  // ✅ CRITICAL: Sends cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// ==========================================
// REQUEST INTERCEPTOR
// ==========================================
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // ✅ DEBUG: Log outgoing requests
    if (import.meta.env.MODE === 'development') {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`, {
        hasToken: !!token,
        withCredentials: config.withCredentials
      });
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// ==========================================
// RESPONSE INTERCEPTOR
// ==========================================

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

const onTokenRefreshed = (token: string) => {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (callback: (token: string) => void) => {
  refreshSubscribers.push(callback);
};

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // Network error (no response)
    if (!error.response) {
      return Promise.reject({
        ...error,
        message: 'Network error. Check your connection.',
      });
    }

    const { status, data } = error.response as any;
    const errorCode = data?.error?.code;
    const errorMessage = data?.error?.message || '';

    // ✅ FIXED: Better 401 handling
    if (status === 401) {
      // If already retrying or it's a refresh request, logout
      if (originalRequest._retry || originalRequest.url?.includes('/auth/refresh')) {
        localStorage.removeItem('token');
        // Only redirect if not already on login
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // Try to refresh token
      if (!isRefreshing) {
        isRefreshing = true;
        originalRequest._retry = true;

        try {
          console.log('[API] Attempting token refresh...');
          const response = await api.post('/auth/refresh');
          const { accessToken } = response.data.data;

          localStorage.setItem('token', accessToken);
          console.log('[API] Token refreshed successfully');
          onTokenRefreshed(accessToken);
          isRefreshing = false;

          return api(originalRequest);
        } catch (refreshError: any) {
          console.error('[API] Token refresh failed:', refreshError.message);
          isRefreshing = false;
          refreshSubscribers = [];
          localStorage.removeItem('token');
          
          if (!window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      }

      // Queue request while refreshing
      return new Promise((resolve) => {
        addRefreshSubscriber((token: string) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          resolve(api(originalRequest));
        });
      });
    }

    // Handle 403
    if (status === 403) {
      return Promise.reject({
        ...error,
        message: errorMessage || 'Access denied.',
        code: errorCode || 'FORBIDDEN',
      });
    }

    if (status === 404) {
      return Promise.reject({
        ...error,
        message: errorMessage || 'Resource not found.',
        code: errorCode || 'NOT_FOUND',
      });
    }

    if (status === 429) {
      return Promise.reject({
        ...error,
        message: errorMessage || 'Too many requests.',
        code: 'RATE_LIMIT',
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