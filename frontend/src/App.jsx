import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Suspense, lazy } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { SocketProvider } from '@/contexts/SocketContext';

// Layouts
import MainLayout from '@/components/layout/MainLayout';
import DashboardLayout from '@/components/layout/DashboardLayout';

// Public Pages (Eager loaded for faster initial render)
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import VerifyEmailPage from '@/pages/VerifyEmailPage';
import AuthSuccessPage from './pages/AuthSuccesspage.tsx';
import OAuthCallback from './pages/OAuthCallback';
import BookArtisan from '@/pages/BookArtisan';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import ArtisansPage from '@/pages/ArtisansPage';
import ArtisanProfilePage from '@/pages/ArtisanProfilePage';
import JobsPage from '@/pages/JobsPage';
import JobDetailsPage from '@/pages/JobDetailsPage';


// Lazy loaded dashboard pages for better performance
const CustomerDashboard = lazy(() => import('@/pages/customer/Dashboard'));
const CustomerJobs = lazy(() => import('@/pages/customer/Jobs'));
const CustomerJobDetails = lazy(() => import('@/pages/customer/JobDetails'));
const CustomerBookings = lazy(() => import('@/pages/customer/Bookings'));
const CustomerMessages = lazy(() => import('@/pages/customer/Messages'));
const CustomerProfile = lazy(() => import('@/pages/customer/Profile'));
const PostJobPage = lazy(() => import('@/pages/customer/PostJob'));
const CustomerVerificationPage = lazy(() => import('@/pages/customer/Verification'));

const ArtisanDashboard = lazy(() => import('@/pages/artisan/Dashboard'));
const ArtisanJobs = lazy(() => import('@/pages/artisan/Jobs'));
const ArtisanJobDetails = lazy(() => import('@/pages/artisan/JobDetails'));
const ArtisanApplications = lazy(() => import('@/pages/artisan/Applications'));
const ArtisanMessages = lazy(() => import('@/pages/artisan/Messages'));
const ArtisanProfile = lazy(() => import('@/pages/artisan/Profile'));
const ArtisanWallet = lazy(() => import('@/pages/artisan/Wallet'));
const ArtisanVerificationPage = lazy(() => import('@/pages/artisan/Verification'));

// Shared Pages
const ChatPage = lazy(() => import('@/pages/ChatPage'));
import PaymentCallbackPage from '@/pages/PaymentCallbackPage';
import NotFoundPage from '@/pages/NotFoundPage';

// Auth Components
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import RoleRoute from '@/components/auth/RoleRoute';
import { TierGate } from '@/components/auth/TierGate';


// ==========================================
// LOADING COMPONENT
// ==========================================

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500" />
      <p className="text-gray-500 text-sm animate-pulse">Loading...</p>
    </div>
  </div>
);

// ==========================================
// MAIN APP COMPONENT
// ==========================================

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SocketProvider>
          <Toaster
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              style: {
                fontFamily: 'inherit',
              },
              duration: 4000,
            }}
          />
          
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* ==========================================
                  PUBLIC ROUTES (with MainLayout)
                  ========================================== */}
              <Route element={<MainLayout />}>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/auth/success" element={<AuthSuccessPage />} />
                <Route path="/oauth/callback" element={<OAuthCallback />} />
                <Route path="/book/:artisanId" element={<BookArtisan />} />
                <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
                <Route path="/artisans" element={<ArtisansPage />} />
                <Route path="/artisans/:artisanId" element={<ArtisanProfilePage />} />
                
                {/* Public job browsing */}
                <Route path="/jobs" element={<JobsPage />} />
                <Route path="/jobs/:id" element={<JobDetailsPage />} />
              </Route>

              {/* ==========================================
                  PAYMENT CALLBACK (no layout - popup handling)
                  ========================================== */}
              <Route path="/payment/callback" element={<PaymentCallbackPage />} />

              {/* ==========================================
                  PROTECTED CUSTOMER ROUTES
                  ========================================== */}
              <Route element={<ProtectedRoute />}>
                <Route element={<RoleRoute allowedRoles={['customer']} />}>
                  <Route element={<DashboardLayout />}>
                    <Route path="/customer/dashboard" element={<CustomerDashboard />} />
                    <Route path="/customer/jobs" element={<CustomerJobs />} />
                    <Route path="/customer/jobs/:id" element={<CustomerJobDetails />} />
                    <Route path="/customer/bookings" element={<CustomerBookings />} />
                    <Route path="/customer/messages" element={<CustomerMessages />} />
                    <Route path="/customer/messages/:conversationId" element={<ChatPage />} />
                    <Route path="/customer/profile" element={<CustomerProfile />} />
                    
                    {/* Tier-gated job posting */}
                    <Route 
                      path="/customer/post-job" 
                      element={
                        <TierGate maxAmount={10000}>
                          <PostJobPage />
                        </TierGate>
                      } 
                    />
                    <Route 
                      path="/customer/post-job/:artisanId" 
                      element={
                        <TierGate maxAmount={10000}>
                          <PostJobPage />
                        </TierGate>
                      } 
                    />
                    
                    {/* Verification upgrade page */}
                    <Route path="/customer/verify" element={<CustomerVerificationPage />} />
                  </Route>
                </Route>
              </Route>

              {/* ==========================================
                  PROTECTED ARTISAN ROUTES
                  ========================================== */}
              <Route element={<ProtectedRoute />}>
                <Route element={<RoleRoute allowedRoles={['artisan']} />}>
                  <Route element={<DashboardLayout />}>
                    <Route path="/artisan/dashboard" element={<ArtisanDashboard />} />
                    <Route path="/artisan/jobs" element={<ArtisanJobs />} />
                    <Route path="/artisan/jobs/:id" element={<ArtisanJobDetails />} />
                    <Route path="/artisan/applications" element={<ArtisanApplications />} />
                    <Route path="/artisan/messages" element={<ArtisanMessages />} />
                    <Route path="/artisan/messages/:conversationId" element={<ChatPage />} />
                    <Route path="/artisan/profile" element={<ArtisanProfile />} />
                    <Route path="/artisan/wallet" element={<ArtisanWallet />} />
                    <Route path="/artisan/verify" element={<ArtisanVerificationPage />} />
                  </Route>
                </Route>
              </Route>

              {/* ==========================================
                  SHARED PROTECTED ROUTES (both roles)
                  ========================================== */}
              <Route element={<ProtectedRoute />}>
                <Route path="/chat/:conversationId" element={<ChatPage />} />
                <Route path="/messages" element={<NavigateToMessages />} />
              </Route>

              {/* ==========================================
                  REDIRECTS
                  ========================================== */}
              <Route path="/customer" element={<Navigate to="/customer/dashboard" replace />} />
              <Route path="/artisan" element={<Navigate to="/artisan/dashboard" replace />} />
              
              {/* Legacy redirects */}
              <Route path="/dashboard" element={<NavigateToDashboard />} />
              <Route path="/profile" element={<NavigateToProfile />} />
              <Route path="/wallet" element={<NavigateToWallet />} />

              {/* ==========================================
                  404 CATCH-ALL
                  ========================================== */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

// ==========================================
// REDIRECT HELPER COMPONENTS
// ==========================================

import { useAuth } from '@/contexts/AuthContext';

function NavigateToMessages() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  
  return user.role === 'artisan' 
    ? <Navigate to="/artisan/messages" replace />
    : <Navigate to="/customer/messages" replace />;
}

function NavigateToDashboard() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  
  return user.role === 'artisan' 
    ? <Navigate to="/artisan/dashboard" replace />
    : <Navigate to="/customer/dashboard" replace />;
}

function NavigateToProfile() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  
  return user.role === 'artisan' 
    ? <Navigate to="/artisan/profile" replace />
    : <Navigate to="/customer/profile" replace />;
}

function NavigateToWallet() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  
  if (user.role !== 'artisan') {
    return <Navigate to="/customer/dashboard" replace />;
  }
  
  return <Navigate to="/artisan/wallet" replace />;
}

export default App;