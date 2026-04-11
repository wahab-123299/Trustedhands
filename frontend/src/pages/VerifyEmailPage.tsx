import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { authApi } from '@/services/api';
import { toast } from 'sonner';

const VerifyEmailPage = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      await authApi.verifyEmail(token!);
      setStatus('success');
      toast.success('Email verified successfully!');
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error) {
      setStatus('error');
      toast.error('Failed to verify email');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Verifying your email address...'}
            {status === 'success' && 'Your email has been verified!'}
            {status === 'error' && 'Verification failed'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          {status === 'loading' && (
            <Loader2 className="w-16 h-16 animate-spin text-emerald-500 mb-4" />
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <p className="text-gray-600 text-center mb-6">
                Your email has been successfully verified. You can now log in to your account.
              </p>
              <Link to="/login">
                <Button className="bg-emerald-500 hover:bg-emerald-600">
                  Go to Login
                </Button>
              </Link>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mb-4" />
              <p className="text-gray-600 text-center mb-6">
                The verification link is invalid or has expired. Please request a new verification email.
              </p>
              <Link to="/login">
                <Button variant="outline">Back to Login</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmailPage;
