import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

// Debug logs setup
const debugLogs: string[] = [];
const addLog = (msg: string) => {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}`;
  debugLogs.push(line);
  console.log(line);
  if (debugLogs.length > 50) debugLogs.shift();
};

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
  timeout: 60000,
});

api.defaults.withCredentials = true;

// Token storage helpers
const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
};

const storeTokens = (accessToken: string, refreshToken?: string, rememberMe?: boolean): void => {
  if (typeof window === 'undefined') return;
  
  const useLocal = rememberMe !== false;
  
  if (useLocal) {
    localStorage.setItem('token', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    if (rememberMe) localStorage.setItem('rememberMe', 'true');
  } else {
    sessionStorage.setItem('token', accessToken);
    if (refreshToken) sessionStorage.setItem('refreshToken', refreshToken);
    localStorage.removeItem('rememberMe');
  }
};

const clearTokens = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('rememberMe');
  localStorage.removeItem('user');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('user');
};

const isRememberMe = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('rememberMe') === 'true';
};

// Refresh token state
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

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();
    
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiryTime = payload.exp * 1000;
        const now = Date.now();
        
        if (now >= expiryTime + 60000) {
          addLog(`[Request] Token truly expired, clearing`);
          clearTokens();
        } else if (now >= expiryTime) {
          addLog(`[Request] Token in grace period, using anyway`);
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          config.headers.Authorization = `Bearer ${token}`;
          const timeLeft = Math.floor((expiryTime - now) / 1000);
          addLog(`[Request] ${config.method?.toUpperCase()} ${config.url} - Token valid (${timeLeft}s left)`);
        }
      } catch (e) {
        addLog(`[Request] Invalid token format, clearing`);
        clearTokens();
      }
    } else {
      addLog(`[Request] ${config.method?.toUpperCase()} ${config.url} - NO TOKEN`);
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    addLog(`[Response] ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`);
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

    if (!error.response) {
      addLog(`[Response] Network error: ${error.message}`);
      
      const retryCount = originalRequest._retryCount || 0;
      if (retryCount < 2 && error.code === 'ECONNABORTED') {
        addLog(`[Response] Retrying network error (${retryCount + 1}/2)...`);
        originalRequest._retryCount = retryCount + 1;
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

    if (status === 401) {
      addLog('[Response] Got 401, checking if we should refresh...');

      if (originalRequest._retry || originalRequest.url?.includes('/auth/refresh')) {
        addLog('[Response] Already retried or is refresh request - clearing token');
        clearTokens();
        return Promise.reject(error);
      }

      if (isRefreshing && refreshPromise) {
        addLog('[Response] Token refresh in progress, queuing request');
        return new Promise((resolve) => {
          addRefreshSubscriber((token: string) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            resolve(api(originalRequest));
          });
        });
      }

      isRefreshing = true;
      originalRequest._retry = true;

      refreshPromise = (async () => {
        try {
          addLog('[Response] Calling /auth/refresh...');
          const refreshToken = getRefreshToken();
          
          if (!refreshToken) {
            throw new Error('No refresh token available');
          }
          
          const response = await api.post('/auth/refresh', { refreshToken });
          const { accessToken } = response.data.data || response.data;

          addLog(`[Response] Token refreshed: ${accessToken.substring(0, 15)}...`);
          
          storeTokens(accessToken, refreshToken, isRememberMe());
          onTokenRefreshed(accessToken);
          return accessToken;
        } catch (refreshError: any) {
          addLog(`[Response] Refresh failed: ${refreshError.message}`);
          clearTokens();
          throw refreshError;
        } finally {
          isRefreshing = false;
          refreshPromise = null;
        }
      })();

      try {
        const newToken = await refreshPromise;
        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    if (status === 403) {
      if (errorCode === 'AUTH_UNAUTHORIZED' || errorCode === 'AUTH_TOKEN_EXPIRED') {
        clearTokens();
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

// Server wake-up helper
export const wakeUpServer = async (): Promise<boolean> => {
  try {
    addLog('[WakeUp] Pinging server...');
    await axios.get(`${API_URL.replace('/api', '')}/health`, { 
      timeout: 10000,
      withCredentials: true 
    });
    addLog('[WakeUp] Server is awake');
    return true;
  } catch (error: any) {
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

// OAuth helpers
export const loginWithGoogle = (): void => {
  const baseUrl = API_URL.replace('/api', '');
  window.location.href = `${baseUrl}/auth/google`;
};

export const loginWithFacebook = (): void => {
  const baseUrl = API_URL.replace('/api', '');
  window.location.href = `${baseUrl}/auth/facebook`;
};

export const handleOAuthCallback = (accessToken: string, refreshToken: string, rememberMe = false): void => {
  storeTokens(accessToken, refreshToken, rememberMe);
  addLog(`[OAuth] Tokens stored (rememberMe: ${rememberMe})`);
};

// Auth storage exports
export const authStorage = {
  getToken,
  getRefreshToken,
  storeTokens,
  clearTokens,
  isRememberMe,
};

// API Interfaces
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

// Artisan data transformer - handles backend/frontend field name mismatches
const transformArtisanData = (artisan: any): any | null => {
  if (!artisan) return null;
  
  const userData = artisan.userId || artisan.user;
  
  return {
    id: artisan.id || artisan._id,
    profession: artisan.profession || artisan.Profession,
    name: artisan.name || userData?.fullName,
    email: artisan.email || userData?.email,
    phone: artisan.phone || userData?.phone,
    location: artisan.location || userData?.location,
    profileImage: artisan.profileImage || userData?.profileImage,
    isVerified: artisan.isVerified || userData?.isVerified,
    userId: userData?._id || userData,
    skills: artisan.skills || [],
    bio: artisan.bio,
    experienceYears: artisan.experienceYears,
    hourlyRate: artisan.hourlyRate || artisan.rate?.amount,
    ratePeriod: artisan.ratePeriod || artisan.rate?.period,
    isAvailable: artisan.isAvailable || artisan.availability?.status === 'available',
    availabilityStatus: artisan.availabilityStatus || artisan.availability?.status,
    nextAvailableDate: artisan.availability?.nextAvailableDate,
    workRadius: artisan.workRadius,
    rating: artisan.rating || artisan.averageRating,
    reviewCount: artisan.reviewCount || artisan.totalReviews,
    completedJobs: artisan.completedJobs,
    portfolioImages: artisan.portfolioImages || [],
    idVerification: artisan.idVerification,
    isCertified: artisan.isCertified,
    canApplyForHighValueJobs: artisan.canApplyForHighValueJobs,
    createdAt: artisan.createdAt,
    updatedAt: artisan.updatedAt,
  };
};

// Auth API
export const authApi = {
  login: (data: LoginData, rememberMe = false) => {
    addLog(`[Auth] Login attempt (rememberMe: ${rememberMe})`);
    return api.post<ApiResponse<{ user: any; accessToken: string; refreshToken: string; dashboardRoute: string }>>('/auth/login', data)
      .then(response => {
        const { accessToken, refreshToken } = response.data.data || response.data;
        if (accessToken) {
          storeTokens(accessToken, refreshToken, rememberMe);
        }
        return response;
      });
  },
  
  register: (data: RegisterData, rememberMe = false) => {
    addLog(`[Auth] Register attempt (rememberMe: ${rememberMe})`);
    return api.post<ApiResponse<{ user: any; accessToken: string; refreshToken: string; dashboardRoute: string }>>('/auth/register', data)
      .then(response => {
        const { accessToken, refreshToken } = response.data.data || response.data;
        if (accessToken) {
          storeTokens(accessToken, refreshToken, rememberMe);
        }
        return response;
      });
  },
  
  logout: () => {
    clearTokens();
    return api.post<ApiResponse<void>>('/auth/logout');
  },
  
  refresh: () => api.post<ApiResponse<{ accessToken: string }>>('/auth/refresh'),
  
  verifyEmail: (token: string) => api.post<ApiResponse<void>>(`/auth/verify-email/${token}`),
  
  resendVerification: (email: string) => api.post<ApiResponse<void>>('/auth/resend-verification', { email }),
  
  forgotPassword: (email: string) => api.post<ApiResponse<void>>('/auth/forgot-password', { email }),
  
  resetPassword: (token: string, password: string) => api.post<ApiResponse<void>>(`/auth/reset-password/${token}`, { password }),
};

// User API
export const userApi = {
  getMe: () => api.get<ApiResponse<any>>('/users/me'),
  
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
  
  deleteMe: () => api.delete<ApiResponse<void>>('/users/me'),
};

// Artisan interfaces
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

// Artisan API with transformed responses
export const artisanApi = {
  getAll: async (params?: { 
    state?: string; 
    city?: string; 
    skills?: string; 
    availability?: string; 
    minRating?: number;
    maxRate?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
  }) => {
    const response = await api.get<ApiResponse<{ artisans: any[]; pagination: any }>>('/artisans', { params });
    
    if (response.data?.data?.artisans) {
      response.data.data.artisans = response.data.data.artisans
        .map(transformArtisanData)
        .filter(Boolean);
    }
    
    return response;
  },
  
  search: async (query: string, params?: { page?: number; limit?: number }) => {
    const response = await api.get<ApiResponse<{ artisans: any[]; pagination: any }>>('/artisans/search', { 
      params: { q: query, ...params } 
    });
    
    if (response.data?.data?.artisans) {
      response.data.data.artisans = response.data.data.artisans
        .map(transformArtisanData)
        .filter(Boolean);
    }
    
    return response;
  },
  
  getNearby: async (lat: number, lng: number, radius?: number, params?: any) => {
    const response = await api.get<ApiResponse<{ artisans: any[]; pagination: any }>>('/artisans/nearby', { 
      params: { lat, lng, radius, ...params } 
    });
    
    if (response.data?.data?.artisans) {
      response.data.data.artisans = response.data.data.artisans
        .map(transformArtisanData)
        .filter(Boolean);
    }
    
    return response;
  },
  
  getById: async (id: string) => {
    const response = await api.get<ApiResponse<{ artisan: any; reviews: any[] }>>(`/artisans/${id}`);
    
    if (response.data?.data?.artisan) {
      response.data.data.artisan = transformArtisanData(response.data.data.artisan);
    }
    
    return response;
  },
  
  getReviews: (id: string, params?: { page?: number; limit?: number }) => 
    api.get<ApiResponse<{ reviews: any[]; ratingStats: any[]; pagination: any }>>(`/artisans/${id}/reviews`, { params }),
  
  updateProfile: (data: ArtisanProfileUpdate) => api.put<ApiResponse<{ artisan: any }>>('/artisans/profile', data),
  
  updateAvailability: (data: { status: 'available' | 'unavailable' | 'busy'; nextAvailableDate?: string }) => 
    api.put<ApiResponse<{ availability: any }>>('/artisans/availability', data),
  
  updateBankDetails: (data: BankDetails) => api.put<ApiResponse<{ bankDetails: BankDetails }>>('/artisans/bank-details', data),
  
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

// Job interfaces and API
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
  create: (data: JobCreateData) => api.post<ApiResponse<{ job: any }>>('/jobs', data),
  
  getMyJobs: (params?: { status?: string; page?: number; limit?: number }) => 
    api.get<ApiResponse<{ jobs: any[]; pagination: any }>>('/jobs/my-jobs', { params }),
  
  getById: (id: string) => api.get<ApiResponse<{ job: any }>>(`/jobs/${id}`),

  getJobApplications: (jobId: string) => api.get(`/jobs/${jobId}/applications`),
  
  // ✅ ADDED: Delete job permanently
  deleteJob: (id: string) => api.delete<ApiResponse<void>>(`/jobs/${id}`),
  
  accept: (id: string) => api.put<ApiResponse<{ job: any }>>(`/jobs/${id}/accept`),

  acceptApplication: (applicationId: string) => api.post(`/jobs/applications/${applicationId}/accept`),
  
  start: (id: string) => api.put<ApiResponse<{ job: any }>>(`/jobs/${id}/start`),
  
  complete: (id: string) => api.put<ApiResponse<{ job: any }>>(`/jobs/${id}/complete`),
  
  confirmCompletion: (id: string, data?: { rating?: number; comment?: string }) => 
    api.put<ApiResponse<{ job: any }>>(`/jobs/${id}/confirm-completion`, data),
  
  cancel: (id: string, reason?: string) => api.put<ApiResponse<{ job: any }>>(`/jobs/${id}/cancel`, { reason }),

  rejectApplication: (applicationId: string) => api.post(`/jobs/applications/${applicationId}/reject`),
  
  addReview: (id: string, data: ReviewData) => api.post<ApiResponse<{ review: any }>>(`/jobs/${id}/review`, data),
  
  getAll: (params?: { status?: string; category?: string; page?: number; limit?: number }) => 
    api.get<ApiResponse<{ jobs: any[]; pagination: any }>>('/jobs', { params }),
  
  apply: (id: string, data?: { coverLetter?: string; proposedRate?: number }) => 
    api.post<ApiResponse<void>>(`/jobs/${id}/apply`, data),
};

// Applications API
export const applicationsApi = {
  getMyApplications: (params?: { status?: string; page?: number; limit?: number }) => 
    api.get<ApiResponse<{ applications: any[]; pagination: any }>>('/applications/my-applications', { params }),
  
  getApplicationById: (id: string) => api.get<ApiResponse<{ application: any }>>(`/applications/${id}`),
  
  withdrawApplication: (id: string) => api.put<ApiResponse<void>>(`/applications/${id}/withdraw`),
};

// Payment interfaces and API
export interface PaymentInitializeData {
  jobId: string;
  email?: string;
  metadata?: Record<string, any>;
}

export const walletApi = {
  getBalance: () => api.get('/payments/wallet'),
  initializeDeposit: (amount: number) => api.post('/payments/initialize', { amount }),
  withdraw: (amount: number) => api.post('/payments/withdraw', { amount }),
  getTransactions: (params?: { page?: number; limit?: number }) => api.get('/payments/history', { params }),
};

export const paymentApi = {
  initialize: (data: PaymentInitializeData) => 
    api.post<ApiResponse<{ authorization_url: string; reference: string; transactionId: string; amount: any }>>('/payments/initialize', data),
  
  verify: (reference: string) => api.get<ApiResponse<{ transaction: any; paystackData: any }>>(`/payments/verify/${reference}`),
  
  verifyPayment: (reference: string) => api.get(`/payments/verify/${reference}`),

  releasePayment: (jobId: string) => api.put<ApiResponse<{ transaction: any; job: any }>>(`/payments/release/${jobId}`),
  
  getHistory: (params?: { type?: string; status?: string; page?: number; limit?: number }) => 
    api.get<ApiResponse<{ transactions: any[]; summary: any; pagination: any }>>('/payments/history', { params }),
  
  getWallet: () => api.get<ApiResponse<{ wallet: any; isNew: boolean }>>('/payments/wallet'),
  
  requestWithdrawal: (amount: number) => 
    api.post<ApiResponse<{ transaction: any; withdrawal: any; wallet: any }>>('/payments/withdraw', { amount }),
  
  getBanks: () => api.get<ApiResponse<{ banks: any[]; count: number }>>('/payments/banks'),
  
  verifyAccount: (data: { accountNumber: string; bankCode: string }) => 
    api.post<ApiResponse<{ accountNumber: string; accountName: string; bankCode: string }>>('/payments/verify-account', data),
};

// Chat interfaces and API
export interface CreateConversationData {
  participantId: string;
  jobId?: string;
}

export const chatApi = {
  getConversations: () => api.get<ApiResponse<{ conversations: any[] }>>('/chat/conversations'),
  
  getMessages: (conversationId: string, params?: { page?: number; limit?: number; before?: string }) => 
    api.get<ApiResponse<{ messages: any[]; pagination: any }>>(`/chat/conversations/${conversationId}/messages`, { params }),
  
  createConversation: (data: CreateConversationData) => 
    api.post<ApiResponse<{ conversation: any }>>('/chat/conversations', data),
  
  deleteConversation: (id: string) => api.delete<ApiResponse<void>>(`/chat/conversations/${id}`),
  
  markAsRead: (conversationId: string) => api.put<ApiResponse<void>>(`/chat/conversations/${conversationId}/read`),
};

// Error handlers
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
// ==========================================
// VERIFICATION API
// ==========================================

export const verificationApi = {
  getStatus: () => api.get('/verify/status'),
  
  checkJobValue: (jobValue: number) => api.get(`/verify/check-job/${jobValue}`),
  
  verifyNIN: (nin: string) => api.post('/verify/nin', { nin }),
  
  verifyBVN: (bvn: string) => api.post('/verify/bvn', { bvn }),
  
  verifyPhoto: (photoFile: File) => {
    const formData = new FormData();
    formData.append('photo', photoFile);
    return api.post('/verify/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  verifyCAC: (cacNumber: string, businessName: string) => 
    api.post('/verify/cac', { cacNumber, businessName }),
  
  verifyShopLocation: (gps: { lat: number; lng: number }) => 
    api.post('/verify/shop-location', { gps }),
    
  confirmShopLocation: () => api.post('/verify/confirm-shop-location'),
};

// ==========================================
// JOB API WITH FRAUD & ESCROW
// ==========================================

// Interfaces for jobFraudApi
export interface FraudJobCreateData {
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
  budgetType?: string;
  scheduledDate: string;
  requiresVerifiedArtisan?: boolean;
}

export interface FraudJobParams {
  status?: string;
  category?: string;
  page?: number;
  limit?: number;
  [key: string]: any;
}

export interface FraudJob {
  id: string;
  title: string;
  description: string;
  // ...add other relevant fields as needed
}

export interface FraudJobApplicationData {
  coverLetter?: string;
  proposedRate?: number;
}

export interface FraudJobReviewData {
  rating: number;
  comment?: string;
}

export interface FraudJobDisputeData {
  milestoneIndex: number;
  issueType: 'incomplete' | 'quality' | 'delay' | 'no_show' | 'other';
  description: string;
  desiredOutcome: 'full_refund' | 'partial' | 'continue';
  partialAmount?: number;
}

export const jobFraudApi = {
  // Create job with fraud detection
  createJob: (data: FraudJobCreateData) =>
    api.post<ApiResponse<{ job: FraudJob }>>('/jobs', data),

  // Get all jobs
  getJobs: (params?: FraudJobParams) =>
    api.get<ApiResponse<{ jobs: FraudJob[]; pagination: any }>>('/jobs', { params }),

  // Get job by ID (includes disputes)
  getJobById: (id: string) =>
    api.get<ApiResponse<{ job: FraudJob }>>(`/jobs/${id}`),

  // Get my jobs
  getMyJobs: (params?: FraudJobParams) =>
    api.get<ApiResponse<{ jobs: FraudJob[]; pagination: any }>>('/jobs/my-jobs', { params }),

  // Update job
  updateJob: (id: string, data: Partial<FraudJobCreateData>) =>
    api.put<ApiResponse<{ job: FraudJob }>>(`/jobs/${id}`, data),

  // Delete job
  deleteJob: (id: string) =>
    api.delete<ApiResponse<void>>(`/jobs/${id}`),

  // Apply for job
  applyForJob: (id: string, data?: FraudJobApplicationData) =>
    api.post<ApiResponse<void>>(`/jobs/${id}/apply`, data),

  // Accept application
  acceptApplication: (applicationId: string) =>
    api.post<ApiResponse<void>>(`/jobs/applications/${applicationId}/accept`),

  // Reject application
  rejectApplication: (applicationId: string) =>
    api.post<ApiResponse<void>>(`/jobs/applications/${applicationId}/reject`),

  // Get applications
  getApplications: (id: string) =>
    api.get<ApiResponse<{ applications: any[] }>>(`/jobs/${id}/applications`),

  // Job status actions
  acceptJob: (id: string) =>
    api.post<ApiResponse<{ job: FraudJob }>>(`/jobs/${id}/accept`),

  startJob: (id: string) =>
    api.post<ApiResponse<{ job: FraudJob }>>(`/jobs/${id}/start`),

  completeJob: (id: string) =>
    api.post<ApiResponse<{ job: FraudJob }>>(`/jobs/${id}/complete`),

  cancelJob: (id: string, reason?: string) =>
    api.post<ApiResponse<{ job: FraudJob }>>(`/jobs/${id}/cancel`, { reason }),

  addReview: (id: string, data: FraudJobReviewData) =>
    api.post<ApiResponse<{ review: any }>>(`/jobs/${id}/review`, data),
};

// ==========================================
// DISPUTE API
// ==========================================

export const disputeApi = {
  // File a dispute
  fileDispute: (jobId: string, data: {
    milestoneIndex: number;
    issueType: 'incomplete' | 'quality' | 'delay' | 'no_show' | 'other';
    description: string;
    desiredOutcome: 'full_refund' | 'partial' | 'continue';
    partialAmount?: number;
  }) => api.post(`/jobs/${jobId}/disputes`, data),
  
  // Get disputes for a job
  getJobDisputes: (jobId: string) => api.get(`/jobs/${jobId}/disputes`),
  
  // Approve milestone (release payment)
  approveMilestone: (jobId: string, milestoneIndex: number) => 
    api.put(`/jobs/${jobId}/milestones/${milestoneIndex}/approve`),
  
  // Admin only
  getAllDisputes: (params?: { status?: string; page?: number }) => 
    api.get('/jobs/admin/disputes', { params }),
    
  resolveDispute: (disputeId: string, resolution: any) => 
    api.put(`/jobs/admin/disputes/${disputeId}/resolve`, resolution),
};

// Export all APIs
export { api };
export default api;
