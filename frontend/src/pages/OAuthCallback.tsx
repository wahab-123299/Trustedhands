import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { api, authStorage } from '@/services/api';

const OAuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { updateUserFromOAuth } = useAuth();
  const [status, setStatus] = useState('Processing login...');

  useEffect(() => {
    const processOAuth = async () => {
      try {
        const token = searchParams.get('token');
        const refreshToken = searchParams.get('refreshToken');
        const redirect = searchParams.get('redirect') || '/';

        console.log('[OAuthCallback] Token:', token ? 'EXISTS' : 'MISSING');
        console.log('[OAuthCallback] RefreshToken:', refreshToken ? 'EXISTS' : 'MISSING');
        console.log('[OAuthCallback] Redirect:', redirect);

        if (!token) {
          setStatus('Login failed. No token received.');
          toast.error('Login failed. Please try again.');
          setTimeout(() => navigate('/login?error=oauth_failed'), 2000);
          return;
        }

        // Store tokens using authStorage (consistent with rest of app)
        authStorage.storeTokens(token, refreshToken || undefined, true);

        // Fetch user data using the api instance (properly configured with baseURL)
        setStatus('Fetching your profile...');
        
        const response = await api.get('/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });

        const data = response.data;
        const user = data.data?.user || data.user;

        if (!user) {
          throw new Error('No user data received');
        }

        // Store user in localStorage
        localStorage.setItem('user', JSON.stringify(user));

        // Update auth context
        updateUserFromOAuth(user, token);
        
        toast.success(`Welcome ${user.fullName}!`);
        
        // Navigate to destination
        const destination = decodeURIComponent(redirect);
        navigate(destination, { replace: true });

      } catch (err: any) {
        console.error('[OAuthCallback] Error:', err);
        // Clear any partial tokens on error
        authStorage.clearTokens();
        setStatus('Login failed. Please try again.');
        toast.error('Login failed. Please try again.');
        setTimeout(() => navigate('/login?error=oauth_failed'), 2000);
      }
    };

    processOAuth();
  }, [searchParams, navigate, updateUserFromOAuth]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 animate-spin text-emerald-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-800">{status}</h2>
        <p className="text-gray-500 mt-2">Please wait while we complete your login...</p>
      </div>
    </div>
  );
};

export default OAuthCallback;