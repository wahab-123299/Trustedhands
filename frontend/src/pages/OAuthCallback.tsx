import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';

export default function OAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { updateUserFromOAuth } = useAuth();

  const [error, setError] = useState(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const state = searchParams.get('state');

        if (!state) {
          throw new Error('Missing state parameter');
        }

        const response = await api.get(`/auth/oauth-exchange?state=${state}`);
        // Backend returns: { user, accessToken, refreshToken, unreadMessageCount, dashboardRoute }
        const { user, accessToken, dashboardRoute } = response.data.data;

        if (!user || !accessToken) {
          throw new Error('Failed to retrieve user information');
        }

        // Stores the token and connects the socket — setUser alone does not.
        updateUserFromOAuth(user, accessToken);

        toast.success(`Welcome ${user.fullName}!`);

        if (user.oauthPendingRoleSelection || (user.role === 'artisan' && !user.hasProfile)) {
          navigate('/setup-profile', { replace: true });
          return;
        }

        navigate(dashboardRoute || '/', { replace: true });

      } catch (err) {
        console.error('OAuth Callback error:', err);
        const errorMessage = typeof err === 'object' && err !== null
          ? (err as any)?.response?.data?.error?.message || (err as any)?.message
          : undefined;
        setError(errorMessage || 'Authentication failed');
        toast.error('Authentication failed');
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate, updateUserFromOAuth]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full mx-4 p-6 bg-white rounded-xl shadow-sm border text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Failed</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-emerald-600 mx-auto mb-4 animate-spin" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Completing Sign In...</h2>
        <p className="text-gray-600">Please wait while we verify your account</p>
      </div>
    </div>
  );
}