import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { handleOAuthCallback } from '@/services/api';

const AuthSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updateUserFromOAuth } = useAuth();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Completing sign in...');

  useEffect(() => {
    const processOAuth = async () => {
      try {
        const error = searchParams.get('error');
        const errorCode = searchParams.get('errorCode');
        const token = searchParams.get('token');
        const refreshToken = searchParams.get('refreshToken');
        const isNew = searchParams.get('new') === 'true';

        if (error || errorCode || !token) {
          setStatus('error');
          setMessage(errorCode === 'google_failed' 
            ? 'Google sign-in failed. Please try again.' 
            : errorCode === 'facebook_failed'
            ? 'Facebook sign-in failed. Please try again.'
            : 'Sign-in failed. Please try again.');

          setTimeout(() => {
            navigate('/login', { replace: true });
          }, 3000);
          return;
        }

        setMessage('Fetching your profile...');

        // Store tokens and fetch user profile
        const { user } = await handleOAuthCallback(token, refreshToken || '', true);

        if (!user) {
          throw new Error('Failed to load user profile');
        }

        updateUserFromOAuth(user, token);

        setStatus('success');
        setMessage(isNew ? 'Welcome! Your account has been created.' : 'Welcome back!');

        // Short delay to show success message
        setTimeout(() => {
          const destination = user.role === 'artisan' ? '/artisan/dashboard' : '/customer/dashboard';
          navigate(destination, { replace: true });
        }, 1000);

      } catch (err: any) {
        console.error('OAuth success handler error:', err);
        setStatus('error');
        setMessage('Something went wrong. Please try signing in again.');

        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }
    };

    processOAuth();
  }, [searchParams, navigate, updateUserFromOAuth]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        {status === 'loading' && (
          <>
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900">{message}</h2>
            <p className="text-gray-500 mt-2">Please wait while we set things up.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900">{message}</h2>
            <p className="text-gray-500 mt-2">Redirecting you now...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900">Sign-in Failed</h2>
            <p className="text-gray-500 mt-2">{message}</p>
            <p className="text-gray-400 text-sm mt-1">Redirecting to login...</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthSuccessPage;