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
      const refreshToken = searchParams.get('refreshToken');
      const error = searchParams.get('error');

      // Handle backend OAuth errors first
      if (error) {
        console.error('[OAuthCallback] Backend error:', error);
        
        const errorMessages: Record<string, string> = {
          google_failed: 'Google login failed. Please try again.',
          facebook_failed: 'Facebook login failed. Please try again.',
          oauth_error: 'Login failed. Please try again.',
        };
        
        toast.error(errorMessages[error] || 'Authentication failed.');
        navigate('/login?error=' + error, { replace: true });
        return;
      }

      if (!token) {
        toast.error('Authentication failed. No token received.');
        navigate('/login?error=oauth_failed', { replace: true });
        return;
      }

      try {
        // Store tokens
        localStorage.setItem('token', token);
        if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('rememberMe', 'true');

        // Fetch user data
        console.log('[OAuthCallback] Fetching user data...');
        const response = await userApi.getMe();
        const respData = response?.data?.data;
        if (!respData || !respData.user) {
          console.error('[OAuthCallback] Invalid response from /me:', response);
          toast.error('Failed to retrieve user data from server. Please try logging in again.');
          navigate('/login?error=oauth_failed', { replace: true });
          return;
        }
        const { user } = respData;

        console.log(`[OAuthCallback] User: ${user.email}, role: ${user.role}`);

        await updateUserFromOAuth(user, token);


        const dashboardRoute = user.role === 'artisan' 
          ? '/artisan/dashboard' 
          : '/customer/dashboard';

        navigate(dashboardRoute, { replace: true });

      } catch (error: any) {
        console.error('OAuth callback error:', error);
        
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        
        if (error.response?.status === 401) {
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
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-600 text-lg">Completing login...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;