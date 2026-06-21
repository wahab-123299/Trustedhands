import { useEffect, useState } from 'react';
import { adminApi } from '@/services/api';
import { Users, Briefcase, ShieldCheck, DollarSign, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const AdminStats = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getStats();
      setStats(response.data.data);
    } catch (error) {
      toast.error('Failed to load stats');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const statCards = [
    { label: 'Total Users', value: stats?.users?.total || 0, icon: Users, color: 'bg-blue-50 text-blue-700' },
    { label: 'Customers', value: stats?.users?.customers || 0, icon: Users, color: 'bg-green-50 text-green-700' },
    { label: 'Artisans', value: stats?.users?.artisans || 0, icon: Briefcase, color: 'bg-purple-50 text-purple-700' },
    { label: 'Total Jobs', value: stats?.jobs?.total || 0, icon: Briefcase, color: 'bg-orange-50 text-orange-700' },
    { label: 'Completed', value: stats?.jobs?.completed || 0, icon: CheckCircle, color: 'bg-emerald-50 text-emerald-700' },
    { label: 'Active Disputes', value: stats?.disputes?.active || 0, icon: AlertTriangle, color: 'bg-red-50 text-red-700' },
    { label: 'Total Revenue', value: `₦${(stats?.revenue?.totalVolume || 0).toLocaleString()}`, icon: DollarSign, color: 'bg-cyan-50 text-cyan-700' },
    { label: 'Completion Rate', value: `${stats?.jobs?.completionRate || 0}%`, icon: TrendingUp, color: 'bg-yellow-50 text-yellow-700' },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard Overview</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 mb-1">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${card.color}`}>
                  <Icon size={24} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Actions</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
              <span className="text-sm font-medium text-orange-800">Pending Verifications</span>
              <span className="text-lg font-bold text-orange-600">{stats?.jobs?.pending || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-red-800">Active Disputes</span>
              <span className="text-lg font-bold text-red-600">{stats?.disputes?.active || 0}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-800">New Users (30d)</span>
              <span className="text-lg font-bold text-blue-600">{stats?.users?.newThisMonth || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Job Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Completion Rate</span>
              <span className="font-medium">{stats?.jobs?.completionRate || 0}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${stats?.jobs?.completionRate || 0}%` }} />
            </div>
            <div className="flex justify-between text-sm mt-4">
              <span className="text-gray-500">In Progress</span>
              <span className="font-medium">{stats?.jobs?.inProgress || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pending</span>
              <span className="font-medium">{stats?.jobs?.pending || 0}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Disputed</span>
              <span className="font-medium text-red-600">{stats?.jobs?.disputed || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminStats;