import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface RoleRouteProps {
  allowedRoles: string[];
}

const RoleRoute = ({ allowedRoles }: RoleRouteProps) => {
  const { user } = useAuth();

  if (!user?.role || !allowedRoles.includes(user?.role)) {
    // Redirect to appropriate dashboard based on role
    const redirectPath = user?.role === 'artisan' ? '/artisan/dashboard' : '/customer/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  return <Outlet />; // Render child routes
};



export default RoleRoute;