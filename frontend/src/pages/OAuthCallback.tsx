import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { handleOAuthCallback } from '@/services/api';

const OAuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updateUserFromOAuth } = useAuth();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing your login...');

  useEffect(() => {
    const processOAuth = async () => {
      try {
        const token = searchParams.get('token');
        const refreshToken = searchParams.get('refreshToken'); // ✅ Added
        const redirect = searchParams.get('redirect');
        const error = searchParams.get('error');

        if (error) {
          setStatus('error');
          setMessage(`OAuth login failed: ${error}`);
          setTimeout(() => navigate('/login', { replace: true }), 3000);
          return;
        }

        if (!token) {
          setStatus('error');
          setMessage('No authentication token received. Please try again.');
          setTimeout(() => navigate('/login', { replace: true }), 3000);
          return;
        }

        // ✅ Pass refreshToken if available
        const { user } = await handleOAuthCallback(token, refreshToken || undefined, true);

        // Update auth context
        updateUserFromOAuth(user, token);

        setStatus('success');
        setMessage(`Welcome, ${user.fullName}! Redirecting...`);

        // Redirect to the intended destination
        const destination = redirect || (user.role === 'artisan' ? '/artisan/dashboard' : '/customer/dashboard');
        setTimeout(() => navigate(destination, { replace: true }), 1000);

      } catch (err: any) {
        console.error('[OAuthCallback] Error:', err);
        setStatus('error');
        setMessage(err.message || 'Failed to complete login. Please try again.');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    processOAuth();
  }, [searchParams, navigate, updateUserFromOAuth]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center max-w-md mx-auto p-6">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Completing Login</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Login Successful</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Login Failed</h2>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 mt-2">Redirecting to login page...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default OAuthCallbackPage;