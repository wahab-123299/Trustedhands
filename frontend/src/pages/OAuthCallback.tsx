import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUserFromOAuth } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refresh');
    const role = searchParams.get('role');

    if (token) {
      try {
        // Store tokens in localStorage
        localStorage.setItem('token', token);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
        localStorage.setItem('rememberMe', 'true');

        // Build minimal user object that matches User type requirements
        // The backend will provide full user data on next API call
        const minimalUser = {
          _id: 'oauth-temp', // Will be replaced by refreshUser
          email: '', // Will be replaced by refreshUser
          fullName: 'OAuth User', // Will be replaced by refreshUser
          role: (role as 'customer' | 'artisan') || 'customer',
          phone: '',
          isActive: true,
          isEmailVerified: true,
          isVerified: true,
          profileImage: '/default-avatar.png',
          location: {
            state: '',
            city: '',
            address: '',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Update auth context if method exists
        if (updateUserFromOAuth) {
          updateUserFromOAuth(minimalUser as any, token);
        }

        toast.success('Login successful!');
        
        // Redirect based on role
        const dashboardRoute = role === 'artisan' 
          ? '/artisan/dashboard' 
          : '/customer/dashboard';
        
        navigate(dashboardRoute, { replace: true });
      } catch (error) {
        console.error('OAuth callback error:', error);
        toast.error('Login failed. Please try again.');
        navigate('/login?error=oauth_failed', { replace: true });
      }
    } else {
      toast.error('Authentication failed. No token received.');
      navigate('/login?error=oauth_failed', { replace: true });
    }
  }, [searchParams, navigate, updateUserFromOAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 text-lg">Completing login...</p>
        <p className="text-gray-400 text-sm mt-2">Please wait while we redirect you</p>
      </div>
    </div>
  );
};

export default OAuthCallback;