import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

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

// ==========================================
// FIXED: Normalize API URL - strip trailing /api if present
// Export API_URL so other files can use the same stripped URL
// ==========================================
const RAW_API_URL = import.meta.env.VITE_API_URL || 'https://trustedhands.onrender.com/api';
export const API_URL = RAW_API_URL.replace(/\/api\/?$/, '');

addLog(`[API Config] RAW URL: ${RAW_API_URL}`);
addLog(`[API Config] Cleaned BASE URL: ${API_URL}`);

const api = axios.create({
  baseURL: `${API_URL}/api`, // All API calls go to /api/...
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 60000,
});

api.defaults.withCredentials = true;

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

const NO_REFRESH_ENDPOINTS = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/verify-email',
  '/auth/resend-verification',
  '/auth/refresh',
];

const isAuthEndpoint = (url?: string): boolean => {
  if (!url) {
    addLog('[isAuthEndpoint] URL is empty/undefined');
    return false;
  }

  addLog(`[isAuthEndpoint] Checking URL: "${url}"`);

  let pathname = url;
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      pathname = new URL(url).pathname;
      addLog(`[isAuthEndpoint] Extracted pathname: "${pathname}"`);
    }
  } catch {
    // Not a valid full URL, use as-is
  }

  const normalizedPath = pathname.startsWith('/') ? pathname : '/' + pathname;
  addLog(`[isAuthEndpoint] Normalized path: "${normalizedPath}"`);

  const isMatch = NO_REFRESH_ENDPOINTS.some(endpoint => {
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
    const match = normalizedPath === normalizedEndpoint || 
                  normalizedPath.startsWith(normalizedEndpoint + '/');
    if (match) {
      addLog(`[isAuthEndpoint] MATCHED endpoint: "${endpoint}"`);
    }
    return match;
  });

  addLog(`[isAuthEndpoint] Result: ${isMatch}`);
  return isMatch;
};

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getToken();

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const expiryTime = payload.exp * 1000;
        const now = Date.now();
        const timeLeft = expiryTime - now;

        if (timeLeft < -60000) {
          addLog(`[Request] Token expired ${Math.abs(timeLeft)}ms ago, clearing`);
          clearTokens();
        } else if (timeLeft < 0) {
          addLog(`[Request] Token in grace period (${Math.abs(timeLeft)}ms past expiry), using anyway`);
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          config.headers.Authorization = `Bearer ${token}`;
          addLog(`[Request] ${config.method?.toUpperCase()} ${config.url} - Token valid (${Math.floor(timeLeft/1000)}s left)`);
        }
      } catch (e) {
        addLog(`[Request] Invalid token format, clearing`);
        clearTokens();
      }
    } else {
      addLog(`[Request] ${config.method?.toUpperCase()} ${config.url} - NO TOKEN`);
    }

    config.withCredentials = true;

    return config;
  },
  (error) => Promise.reject(error)
);

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
        message: 'Unable to connect to server. Please check your internet connection and try again.',
        isNetworkError: true,
      });
    }

    const { status, data } = error.response as any;
    const errorCode = data?.error?.code || data?.code;
    const errorMessage = data?.error?.message || data?.message || '';

    addLog(`[Response] ERROR ${status}: ${errorCode} - ${errorMessage}`);

    if (status === 401) {
      const requestUrl = originalRequest?.url || 
                        (originalRequest as any)?.baseURL + (originalRequest as any)?.url || 
                        '';

      addLog(`[Response] 401 detected. Request URL: "${requestUrl}"`);

      if (isAuthEndpoint(requestUrl)) {
        addLog('[Response] 401 on auth endpoint, returning original error (NO REFRESH)');
        return Promise.reject(error);
      }

      addLog('[Response] Got 401 on non-auth endpoint, checking if we should refresh...');

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
          const resData = response.data.data || response.data;
          const accessToken = resData.accessToken;
          const newRefreshToken = resData.refreshToken;

          addLog(`[Response] Token refreshed: ${accessToken.substring(0, 15)}...`);

          storeTokens(accessToken, newRefreshToken, isRememberMe());
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

    if (status === 409) {
      return Promise.reject({
        ...error,
        message: errorMessage || 'An account with this email already exists. Please sign in instead.',
        code: 'EMAIL_EXISTS',
      });
    }

    if (status === 400) {
      return Promise.reject({
        ...error,
        message: errorMessage || 'Invalid request. Please check your information and try again.',
        code: errorCode || 'BAD_REQUEST',
      });
    }

    if (status >= 500) {
      return Promise.reject({
        ...error,
        message: 'Server error. Please try again later.',
        code: 'SERVER_ERROR',
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
// FIXED: OAuth login functions - no more double /api/
// ==========================================
export const wakeUpServer = async (): Promise<boolean> => {
  try {
    addLog('[WakeUp] Pinging server...');
    await axios.get(`${API_URL}/health`, { 
      timeout: 10000,
      withCredentials: true 
    });
    addLog('[WakeUp] Server is awake');
    return true;
  } catch (error: any) {
    try {
      await axios.get(`${API_URL}/api/health`, { 
        timeout: 10000,
        withCredentials: true 
      });
      addLog('[WakeUp] Server responded via /api/health');
      return true;
    } catch {
      addLog('[WakeUp] Server ping failed');
      return false;
    }
  }
};

export const loginWithGoogle = (): void => {
  const redirectUrl = `${API_URL}/api/auth/google`;
  addLog(`[OAuth] Redirecting to Google: ${redirectUrl}`);
  window.location.href = redirectUrl;
};

export const loginWithFacebook = (): void => {
  const redirectUrl = `${API_URL}/api/auth/facebook`;
  addLog(`[OAuth] Redirecting to Facebook: ${redirectUrl}`);
  window.location.href = redirectUrl;
};

// ==========================================
// FIXED: handleOAuthCallback — refreshToken is optional (comes from HTTP-only cookie)
// ==========================================
export const handleOAuthCallback = async (
  accessToken: string, 
  refreshToken?: string, 
  rememberMe = false
): Promise<{ user: any }> => {
  storeTokens(accessToken, refreshToken, rememberMe);
  addLog(`[OAuth] Tokens stored (rememberMe: ${rememberMe})`);

  addLog('[OAuth] Fetching user profile...');
  const response = await api.get('/auth/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const resData = response.data.data || response.data;
  const user = resData.user;

  if (user) {
    localStorage.setItem('user', JSON.stringify(user));
  }

  return { user };
};

export const authStorage = {
  getToken,
  getRefreshToken,
  storeTokens,
  clearTokens,
  isRememberMe,
};

export interface ApiResponse<T = any> {
  hasProfile: any;
  artisanProfile: any;
  dashboardRoute: string;
  token: any;
  accessToken: any;
  user: any;
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

const transformArtisanData = (artisan: any): any | null => {
  if (!artisan) return null;

  return {
    ...artisan,
    id: artisan.id || artisan._id,
    name: artisan.name || artisan.fullName || 'Unknown Artisan',
    fullName: artisan.fullName || artisan.name || 'Unknown Artisan',
    rate: artisan.rate || {
      amount: artisan.hourlyRate || 0,
      period: artisan.ratePeriod || 'job'
    },
    location: artisan.location || { city: '', state: '' },
    skills: artisan.skills || [],
    averageRating: artisan.averageRating || artisan.rating || 0,
    totalReviews: artisan.totalReviews || artisan.reviewCount || 0,
    rating: artisan.rating || artisan.averageRating || 0,
    reviewCount: artisan.reviewCount || artisan.totalReviews || 0,
    isAvailable: artisan.availabilityStatus === 'available' || artisan.isAvailable || false,
    availabilityStatus: artisan.availabilityStatus || artisan.availability?.status || 'available',
    completedJobs: artisan.completedJobs || 0,
    portfolioImages: artisan.portfolioImages || [],
    isCertified: artisan.isCertified || false,
    isVerified: artisan.isVerified || false,
  };
};

export const authApi = {
  login: (data: LoginData, rememberMe = false) => {
    addLog(`[Auth] Login attempt (rememberMe: ${rememberMe})`);
    return api.post<ApiResponse<{ user: any; accessToken: string; refreshToken: string; dashboardRoute: string }>>('/auth/login', data)
      .then(response => {
        const resData = response.data.data || response.data;
        const { accessToken, refreshToken } = resData;
        if (accessToken) {
          storeTokens(accessToken, refreshToken, rememberMe);
        }
        return response;
      });
  },

  register: (data: RegisterData, rememberMe = false) => {
    addLog(`[Auth] Register attempt (rememberMe: ${rememberMe})`);
    return api.post<ApiResponse<{ user: any; accessToken?: string; token?: string; refreshToken: string; dashboardRoute: string }>>('/auth/register', data)
      .then(response => {
        addLog(`[Auth] Register response status: ${response.status}`);

        const resData = response.data.data || response.data;
        const accessToken = resData.accessToken || resData.token;
        const refreshToken = resData.refreshToken;

        if (accessToken) {
          storeTokens(accessToken, refreshToken, rememberMe);
          addLog(`[Auth] Register tokens stored`);
        } else {
          addLog(`[Auth] WARNING: No accessToken in register response`);
          addLog(`[Auth] Response keys: ${Object.keys(response.data).join(', ')}`);
          if (response.data.data) {
            addLog(`[Auth] response.data.data keys: ${Object.keys(response.data.data).join(', ')}`);
          }
        }

        return response;
      })
      .catch(error => {
        addLog(`[Auth] Register error: ${error.message}`);
        throw error;
      });
  },

  logout: () => {
    clearTokens();
    return api.post<ApiResponse<void>>('/auth/logout');
  },

  refresh: () => api.post<ApiResponse<{ accessToken: string; refreshToken?: string }>>('/auth/refresh'),

  verifyEmail: (token: string) => api.post<ApiResponse<void>>(`/auth/verify-email/${token}`),

  resendVerification: (email: string) => api.post<ApiResponse<void>>('/auth/resend-verification', { email }),

  forgotPassword: (email: string) => api.post<ApiResponse<void>>('/auth/forgot-password', { email }),

  resetPassword: (token: string, password: string) => api.post<ApiResponse<void>>(`/auth/reset-password/${token}`, { password }),
};

export const userApi = {
  getMe: () => api.get<ApiResponse<any>>('/auth/me'),

  updateMe: (data: Partial<{ fullName: string; phone: string; location: any; profileImage: string }>) => 
    api.put<ApiResponse<any>>('/users/me', data),

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

    console.log('[API] getAll raw response:', JSON.stringify(response.data, null, 2));

    if (response.data?.data?.artisans) {
      response.data.data.artisans = response.data.data.artisans
        .map(transformArtisanData)
        .filter(Boolean);
    }

    return response;
  },

  getMyProfile: async () => {
    const response = await api.get<ApiResponse<any>>('/artisans/me');

    console.log('[API] getMyProfile raw response:', JSON.stringify(response.data, null, 2));

    const responseData = response.data?.data;
    let artisanData: any = null;

    if (responseData?.artisan) {
      artisanData = responseData.artisan;
      console.log('[API] getMyProfile: Found artisan in data.artisan');
    } else if (responseData && !responseData.artisan) {
      const possibleArtisan = responseData as any;
      if (possibleArtisan.userId || possibleArtisan.profession !== undefined || possibleArtisan.skills || possibleArtisan.bio !== undefined) {
        artisanData = possibleArtisan;
        console.log('[API] getMyProfile: Found artisan directly in data');
      }
    }

    if (artisanData) {
      const transformed = transformArtisanData(artisanData);
      response.data.data = { artisan: transformed };
    } else {
      console.log('[API] getMyProfile: No artisan data found');
    }

    return response;
  },

  search: async (query: string, params?: { page?: number; limit?: number }) => {
    const response = await api.get<ApiResponse<{ artisans: any[]; pagination: any }>>('/artisans/search', { 
      params: { q: query, ...params } 
    });

    console.log('[API] search raw response:', JSON.stringify(response.data, null, 2));

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

    console.log('[API] getNearby raw response:', JSON.stringify(response.data, null, 2));

    if (response.data?.data?.artisans) {
      response.data.data.artisans = response.data.data.artisans
        .map(transformArtisanData)
        .filter(Boolean);
    }

    return response;
  },

  getPublicProfile: async (id: string) => {
    const response = await api.get<ApiResponse<{ artisan: any; reviews: any[] }>>(`/artisans/${id}`);

    console.log('[API] getPublicProfile raw response:', JSON.stringify(response.data, null, 2));

    if (response.data?.data?.artisan) {
      response.data.data.artisan = transformArtisanData(response.data.data.artisan);
    }

    return response;
  },

  getById: async (id: string) => {
    return artisanApi.getPublicProfile(id);
  },

  getReviews: (id: string, params?: { page?: number; limit?: number }) => 
    api.get<ApiResponse<{ reviews: any[]; ratingStats: any[]; pagination: any }>>(`/artisans/${id}/reviews`, { params }),

  updateProfile: (data: ArtisanProfileUpdate) => api.put<ApiResponse<{ artisan: any }>>('/artisans/me', data),

  updateAvailability: (data: { status: 'available' | 'unavailable' | 'busy'; nextAvailableDate?: string }) => 
    api.put<ApiResponse<{ availability: any }>>('/artisans/me/availability', data),

  updateBankDetails: (data: BankDetails) => api.put<ApiResponse<{ bankDetails: BankDetails }>>('/artisans/me/bank', data),

  uploadPortfolioImages: (files: FileList | File[]) => {
    const formData = new FormData();
    Array.from(files).forEach(file => formData.append('images', file));
    return api.post<ApiResponse<{ portfolioImages: string[] }>>('/artisans/me/portfolio', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deletePortfolioImage: (imageUrl: string) => 
    api.delete<ApiResponse<{ portfolioImages: string[] }>>('/artisans/me/portfolio', { data: { imageUrl } }),
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
  create: (data: JobCreateData) => api.post<ApiResponse<{ job: any }>>('/jobs', data),

  getMyJobs: (params?: { status?: string; page?: number; limit?: number }) => 
    api.get<ApiResponse<{ jobs: any[]; pagination: any }>>('/jobs/my-jobs', { params }),

  getById: (id: string) => api.get<ApiResponse<{ job: any }>>(`/jobs/${id}`),

  getJobApplications: (jobId: string) => api.get(`/jobs/${jobId}/applications`),

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

export const applicationsApi = {
  getMyApplications: (params?: { status?: string; page?: number; limit?: number }) => 
    api.get<ApiResponse<{ applications: any[]; pagination: any }>>('/applications/my-applications', { params }),

  getApplicationById: (id: string) => api.get<ApiResponse<{ application: any }>>(`/applications/${id}`),

  withdrawApplication: (id: string) => api.put<ApiResponse<void>>(`/applications/${id}/withdraw`),
};

export const walletApi = {
  getBalance: () => api.get('/payments/wallet'),

  initializeDeposit: (amount: number) => 
    api.post('/payments/wallet/deposit/initialize', { amount }),

  withdraw: (amount: number) => api.post('/payments/withdraw', { amount }),

  getTransactions: (params?: { page?: number; limit?: number }) => 
    api.get('/payments/history', { params }),
};

export interface PaymentInitializeData {
  jobId: string;
  email?: string;
  metadata?: Record<string, any>;
}

export const paymentApi = {
  initialize: (data: PaymentInitializeData) => 
    api.post<ApiResponse<{ authorization_url: string; reference: string; transactionId: string; amount: any }>>('/payments/initialize', data),

  verify: (reference: string) => 
    api.get<ApiResponse<{ transaction: any; paystackData: any }>>(`/payments/verify/${reference}`),

  releasePayment: (jobId: string) => 
    api.post<ApiResponse<{ transaction: any; job: any }>>(`/payments/release/${jobId}`),

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
  getConversations: () => api.get<ApiResponse<{ conversations: any[] }>>('/chat/conversations'),

  getMessages: (conversationId: string, params?: { page?: number; limit?: number; before?: string }) => 
    api.get<ApiResponse<{ messages: any[]; pagination: any }>>(`/chat/conversations/${conversationId}/messages`, { params }),

  createConversation: (data: CreateConversationData) => 
    api.post<ApiResponse<{ conversation: any }>>('/chat/conversations', data),

  deleteConversation: (id: string) => api.delete<ApiResponse<void>>(`/chat/conversations/${id}`),

  markAsRead: (conversationId: string) => api.put<ApiResponse<void>>(`/chat/conversations/${conversationId}/read`),
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
  createJob: (data: FraudJobCreateData) =>
    api.post<ApiResponse<{ job: FraudJob }>>('/jobs', data),

  getJobs: (params?: FraudJobParams) =>
    api.get<ApiResponse<{ jobs: FraudJob[]; pagination: any }>>('/jobs', { params }),

  getJobById: (id: string) =>
    api.get<ApiResponse<{ job: FraudJob }>>(`/jobs/${id}`),

  getMyJobs: (params?: FraudJobParams) =>
    api.get<ApiResponse<{ jobs: FraudJob[]; pagination: any }>>('/jobs/my-jobs', { params }),

  updateJob: (id: string, data: Partial<FraudJobCreateData>) =>
    api.put<ApiResponse<{ job: FraudJob }>>(`/jobs/${id}`, data),

  deleteJob: (id: string) =>
    api.delete<ApiResponse<void>>(`/jobs/${id}`),

  applyForJob: (id: string, data?: FraudJobApplicationData) =>
    api.post<ApiResponse<void>>(`/jobs/${id}/apply`, data),

  acceptApplication: (applicationId: string) =>
    api.post<ApiResponse<void>>(`/jobs/applications/${applicationId}/accept`),

  rejectApplication: (applicationId: string) =>
    api.post<ApiResponse<void>>(`/jobs/applications/${applicationId}/reject`),

  getApplications: (id: string) =>
    api.get<ApiResponse<{ applications: any[] }>>(`/jobs/${id}/applications`),

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

export const disputeApi = {
  fileDispute: (jobId: string, data: {
    milestoneIndex: number;
    issueType: 'incomplete' | 'quality' | 'delay' | 'no_show' | 'other';
    description: string;
    desiredOutcome: 'full_refund' | 'partial' | 'continue';
    partialAmount?: number;
  }) => api.post(`/jobs/${jobId}/disputes`, data),

  getJobDisputes: (jobId: string) => api.get(`/jobs/${jobId}/disputes`),

  approveMilestone: (jobId: string, milestoneIndex: number) => 
    api.put(`/jobs/${jobId}/milestones/${milestoneIndex}/approve`),

  getAllDisputes: (params?: { status?: string; page?: number }) => 
    api.get('/jobs/admin/disputes', { params }),

  resolveDispute: (disputeId: string, resolution: any) => 
    api.put(`/jobs/admin/disputes/${disputeId}/resolve`, resolution),
};

export const adminApi = {
  getStats: () => api.get('/admin/dashboard'),

  getUsers: (params?: { page?: number; limit?: number; search?: string; role?: string; isActive?: string }) => 
    api.get('/admin/users', { params }),
  getUserById: (id: string) => api.get(`/admin/users/${id}`),
  updateUserStatus: (id: string, isActive: boolean) => 
    api.patch(`/admin/users/${id}/status`, { isActive }),

  getPendingVerifications: (params?: { page?: number; limit?: number }) => 
    api.get('/admin/verifications/pending', { params }),
  verifyArtisan: (id: string, action: 'approve' | 'reject', reason?: string) => 
    api.post(`/admin/verifications/${id}`, { action, reason }),

  getAllArtisans: (params?: { page?: number; limit?: number }) => 
    api.get('/admin/artisans', { params }),

  getTransactions: (params?: { page?: number; limit?: number; type?: string; status?: string; startDate?: string; endDate?: string }) =>
    api.get('/admin/transactions', { params }),

  getDisputes: (params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/admin/disputes', { params }),
  resolveDispute: (jobId: string, resolution: any) =>
    api.post(`/admin/disputes/${jobId}/resolve`, resolution),
};

export { api };
export default api;