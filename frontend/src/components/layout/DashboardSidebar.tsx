import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  MessageSquare,
  User,
  Wallet,
  FileText,
  Settings,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DashboardSidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const customerLinks = [
    { name: 'Dashboard', href: '/customer/dashboard', icon: LayoutDashboard },
    { name: 'My Jobs', href: '/customer/jobs', icon: Briefcase },
    { name: 'Bookings', href: '/customer/bookings', icon: Calendar },
    { name: 'Messages', href: '/customer/messages', icon: MessageSquare },
    { name: 'Profile', href: '/customer/profile', icon: User },
  ];

  const artisanLinks = [
    { name: 'Dashboard', href: '/artisan/dashboard', icon: LayoutDashboard },
    { name: 'My Jobs', href: '/artisan/jobs', icon: Briefcase },
    { name: 'Applications', href: '/artisan/applications', icon: FileText },
    { name: 'Messages', href: '/artisan/messages', icon: MessageSquare },
    { name: 'Wallet', href: '/artisan/wallet', icon: Wallet },
    { name: 'Profile', href: '/artisan/profile', icon: User },
  ];

  const links = user?.role === 'artisan' ? artisanLinks : customerLinks;

  const bottomLinks = [
    { name: 'Settings', href: `/${user?.role}/settings`, icon: Settings },
    { name: 'Help', href: '/help', icon: HelpCircle },
  ];

  return (
    <aside className="fixed left-0 top-16 bottom-0 w-64 bg-white border-r border-gray-200 hidden lg:block overflow-y-auto">
      <nav className="p-4 space-y-1">
        {links.map((link) => (
          <Link
            key={link.name}
            to={link.href}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
              isActive(link.href)
                ? 'bg-emerald-50 text-emerald-700'
                : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <link.icon className={cn('w-5 h-5', isActive(link.href) ? 'text-emerald-600' : 'text-gray-400')} />
            {link.name}
          </Link>
        ))}

        <div className="pt-4 mt-4 border-t border-gray-200">
          {bottomLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors',
                isActive(link.href)
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <link.icon className={cn('w-5 h-5', isActive(link.href) ? 'text-emerald-600' : 'text-gray-400')} />
              {link.name}
            </Link>
          ))}
        </div>
      </nav>

      {/* Quick Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 bg-gray-50">
        {user?.role === 'customer' ? (
          <Link
            to="/customer/post-job"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            <Briefcase className="w-4 h-4" />
            Post a Job
          </Link>
        ) : (
          <Link
            to="/jobs"
            className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
          >
            <Briefcase className="w-4 h-4" />
            Find Jobs
          </Link>
        )}
      </div>
    </aside>
  );
};

export default DashboardSidebar;
