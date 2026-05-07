import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userApi } from '@/services/api';
import { toast } from 'sonner';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUserFromOAuth } = useAuth();

  useEffect(() => {
    const handleOAuth = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        toast.error('Authentication failed. No token received.');
        navigate('/login?error=oauth_failed', { replace: true });
        return;
      }

      try {
        // Store token immediately so API calls work
        localStorage.setItem('token', token);
        localStorage.setItem('rememberMe', 'true');

        // Fetch real user data from backend
        console.log('[OAuthCallback] Fetching user data...');
        const response = await userApi.getMe();
        const { user, hasProfile } = response.data.data;

        console.log(`[OAuthCallback] User: ${user.email}, role: ${user.role}, hasProfile: ${hasProfile}`);

        // Update auth context with real user (async — handles socket, profile check, redirect)
        await updateUserFromOAuth(user, token);

        // If we reach here, updateUserFromOAuth didn't redirect (user has profile)
        const dashboardRoute = user.role === 'artisan' 
          ? '/artisan/dashboard' 
          : '/customer/dashboard';

        console.log(`[OAuthCallback] Redirecting to ${dashboardRoute}`);
        navigate(dashboardRoute, { replace: true });

      } catch (error: any) {
        console.error('OAuth callback error:', error);
        
        if (error.response?.status === 401 || error.response?.status === 403) {
          toast.error('Session expired. Please log in again.');
        } else {
          toast.error('Login failed. Please try again.');
        }
        
        navigate('/login?error=oauth_failed', { replace: true });
      }
    };

    handleOAuth();
  }, [searchParams, navigate, updateUserFromOAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Completing login...</p>
        <p className="text-gray-400 text-sm mt-2">Please wait while we set up your account</p>
      </div>
    </div>
  );
};

export default OAuthCallback;