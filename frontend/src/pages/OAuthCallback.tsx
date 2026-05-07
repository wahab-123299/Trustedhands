import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userApi } from '@/services/api'; // Import this
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
        // Store token FIRST (updateUserFromOAuth will also do this, but do it early)
        localStorage.setItem('token', token);
        localStorage.setItem('rememberMe', 'true');

        // Fetch REAL user data from backend
        addLog('[OAuthCallback] Fetching real user data...');
        const response = await userApi.getMe();
        const { user, hasProfile } = response.data.data;

        addLog(`[OAuthCallback] Real user: ${user.email}, role: ${user.role}, hasProfile: ${hasProfile}`);

        // Update auth context with REAL user (this handles socket, state, profile check)
        await updateUserFromOAuth(user, token);

        // DON'T navigate here — updateUserFromOAuth handles redirects!
        // If we reach here, it means updateUserFromOAuth didn't redirect (user has profile)
        
        const dashboardRoute = user.role === 'artisan' 
          ? '/artisan/dashboard' 
          : '/customer/dashboard';

        addLog(`[OAuthCallback] Redirecting to ${dashboardRoute}`);
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