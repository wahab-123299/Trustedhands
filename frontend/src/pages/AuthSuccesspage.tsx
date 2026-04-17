// pages/AuthSuccessPage.tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const AuthSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');
    
    if (accessToken && refreshToken) {
      // Check if user previously wanted to be remembered
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      
      if (rememberMe) {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
      } else {
        sessionStorage.setItem('accessToken', accessToken);
        sessionStorage.setItem('refreshToken', refreshToken);
      }
      
      // Fetch user profile
      fetchUserProfile(accessToken);
      
      navigate('/dashboard');
    } else {
      navigate('/login?error=oauth_failed');
    }
  }, []);

  const fetchUserProfile = async (token: string) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/users/me`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const user = await response.json();
      
      const storage = localStorage.getItem('rememberMe') === 'true' 
        ? localStorage 
        : sessionStorage;
      storage.setItem('user', JSON.stringify(user));
    } catch (error) {
      console.error('Failed to fetch user:', error);
    }
  };

  return <div>Completing login...</div>;
};

export default AuthSuccessPage;