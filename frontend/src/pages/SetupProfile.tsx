import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Briefcase, UserCheck } from 'lucide-react';

export default function SetupProfile() {
  const { user, artisanProfile, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If profile now exists, redirect to dashboard
    if (!isLoading && artisanProfile) {
      console.log('[SetupProfile] Profile found, redirecting to dashboard');
      navigate('/artisan/dashboard', { replace: true });
    }
  }, [artisanProfile, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <Briefcase className="w-8 h-8 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Complete Your Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-gray-600 text-center">
            Hi <strong>{user?.fullName || 'Artisan'}</strong>, to start receiving 
            job requests, you need to set up your artisan profile with your skills, 
            experience, and rates.
          </p>

          <div className="space-y-3">
            <Button 
              onClick={() => navigate('/artisan/profile/edit')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 h-12"
            >
              <UserCheck className="w-5 h-5 mr-2" />
              Set Up Profile Now
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => navigate('/')}
              className="w-full"
            >
              Go Back Home
            </Button>
          </div>

          <p className="text-xs text-gray-400 text-center">
            You can also access this from your profile page later.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}