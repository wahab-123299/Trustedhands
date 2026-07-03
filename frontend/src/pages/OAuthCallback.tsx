import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

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

        // Store tokens
        localStorage.setItem('token', token);
        if (refreshToken) {
          localStorage.setItem('refreshToken', refreshToken);
        }
        localStorage.setItem('rememberMe', 'true');

        // Fetch user data
        setStatus('Fetching your profile...');
        const API_URL = import.meta.env.VITE_API_URL || 'https://trustedhands.onrender.com/api';
        
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch user data');
        }

        const data = await response.json();
        const user = data.data?.user || data.user;

        if (!user) {
          throw new Error('No user data received');
        }

        // Update auth context
        updateUserFromOAuth(user, token);
        
        toast.success(`Welcome ${user.fullName}!`);
        
        // Navigate to destination
        const destination = decodeURIComponent(redirect);
        navigate(destination, { replace: true });

      } catch (err: any) {
        console.error('[OAuthCallback] Error:', err);
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