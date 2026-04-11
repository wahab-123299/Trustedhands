import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  LayoutDashboard, 
  Briefcase, 
  MessageSquare, 
  User, 
  Wallet,
  FileText,
  LogOut
} from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const Sidebar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const isArtisan = user?.role === 'artisan';
  
  
  const navItems: NavItem[] = isArtisan ? [
    { path: '/artisan/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: '/artisan/jobs', label: 'Jobs', icon: <Briefcase className="w-5 h-5" /> },
    { path: '/artisan/applications', label: 'Applications', icon: <FileText className="w-5 h-5" /> },
    { path: '/artisan/messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" /> },
    { path: '/artisan/wallet', label: 'Wallet', icon: <Wallet className="w-5 h-5" /> },
    { path: '/artisan/profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ] : [
    { path: '/customer/dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { path: '/customer/jobs', label: 'My Jobs', icon: <Briefcase className="w-5 h-5" /> },
    { path: '/customer/bookings', label: 'Bookings', icon: <FileText className="w-5 h-5" /> },
    { path: '/customer/messages', label: 'Messages', icon: <MessageSquare className="w-5 h-5" /> },
    { path: '/customer/profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen sticky top-0 flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-2xl font-bold text-emerald-600">TrustedHand</h1>
        <p className="text-xs text-gray-500 mt-1">
          {isArtisan ? 'Artisan Dashboard' : 'Customer Dashboard'}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-emerald-50 text-emerald-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Info & Logout */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 mb-4 px-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
            {user?.fullName?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.fullName}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        
        <button
          onClick={logout}
          className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );

  // Use location to highlight active link
  const isActive = (path: string) => location.pathname === path;

  return (
    <nav>
      <a className={isActive('/dashboard') ? 'active' : ''}>
        Dashboard
      </a>
      <a className={isActive('/profile') ? 'active' : ''}>
        Profile
      </a>
    </nav>
  );
};

export default Sidebar;