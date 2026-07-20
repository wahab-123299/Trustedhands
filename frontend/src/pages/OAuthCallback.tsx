import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { Loader2, AlertCircle } from 'lucide-react';

export default function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuth();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const state = searchParams.get('state');
        const redirect = searchParams.get('redirect') || '/customer/dashboard';

        // ==========================================
        // OLD BROKEN FLOW (tokens in URL):
        // const token = searchParams.get('token');
        // const refreshToken = searchParams.get('refreshToken');
        // if (token) { storeTokens(token, refreshToken); ... }
        //
        // NEW SECURE FLOW (state-based):
        // Tokens are in HttpOnly cookies (set by backend)
        // We exchange state for user info
        // ==========================================

        if (!state) {
          throw new Error('Missing state parameter. OAuth flow may have been interrupted.');
        }

        // Exchange state for user info
        // Tokens are already in HttpOnly cookies from the backend redirect
        const response = await api.get(`/auth/oauth-exchange?state=${state}`);
        const { user, isNewUser } = response.data.data;

        if (!user) {
          throw new Error('Failed to retrieve user information');
        }

        // Store user in context (if context exposes setters)
        // Try common auth context methods, fallback to noop with warning
        try {
          if (auth && typeof (auth as any).setUser === 'function') {
            (auth as any).setUser(user);
          } else if (auth && typeof (auth as any).updateUser === 'function') {
            (auth as any).updateUser(user);
          } else if (auth && typeof (auth as any).login === 'function') {
            (auth as any).login(user);
          } else {
            console.warn('No auth setter found to store OAuth user');
          }
        } catch (e) {
          console.warn('Failed to store OAuth user in auth context', e);
        }

        toast.success( `Welcome ${user.fullName}!` );

        //Handle role selection for new OAuth users
        if (isNewUser && user.oauthPendingRoleSelection) {
          // Navigate to role selection page
          navigate('/select-role', { replace: true });
          return;
        }

        // Normal redirect
        navigate(redirect, { replace: true });

      } catch (err: any) {
        console.error('OAuth Callback error:', err);
        setError(err.message || 'Authentication failed');
        toast.error('Authentication failed. Please try again.');
        setTimeout(() => navigate('/login', { replace: true }), 3000); // Redirect to login after 5 seconds
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate, auth]);

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

