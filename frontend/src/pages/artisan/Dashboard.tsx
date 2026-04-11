import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Wallet, Star, TrendingUp, MessageSquare, ArrowRight, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { jobApi, paymentApi } from '@/services/api';
import { Job, Wallet as WalletType } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const ArtisanDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    totalEarnings: 0,
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch jobs and wallet data
      const [jobsRes, walletRes] = await Promise.all([
        jobApi.getMyJobs({ limit: 5 }),
        paymentApi.getWallet(),
      ]);

      // ✅ SAFE EXTRACTION: Handle undefined responses
      const jobs = jobsRes?.data?.data?.jobs || [];
      const walletData = walletRes?.data?.data?.wallet || { 
        balance: 0, 
        totalEarned: 0,
        totalWithdrawn: 0,
        pendingBalance: 0
      };

      setRecentJobs(jobs);
      setWallet(walletData);
      
      // ✅ CALCULATE COUNTS: Frontend calculation with safe checks
      const counts = {
        pending: jobs.filter((j: Job) => j.status === 'pending').length,
        accepted: jobs.filter((j: Job) => j.status === 'accepted').length,
        in_progress: jobs.filter((j: Job) => j.status === 'in_progress').length,
        completed: jobs.filter((j: Job) => j.status === 'completed').length,
        cancelled: jobs.filter((j: Job) => j.status === 'cancelled').length,
      };
      
      setStats({
        totalJobs: jobs.length,
        activeJobs: counts.accepted + counts.in_progress,
        completedJobs: counts.completed,
        totalEarnings: walletData?.totalEarned || 0,
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      
      // ✅ SAFE DEFAULTS: Set empty values on error
      setRecentJobs([]);
      setWallet({ 
        balance: 0,
        totalEarned: 0,
        totalWithdrawn: 0,
        pendingBalance: 0
      } as any);
      setStats({
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        totalEarnings: 0,
      });
      
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      accepted: 'bg-blue-100 text-blue-800 border-blue-200',
      in_progress: 'bg-purple-100 text-purple-800 border-purple-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200',
      disputed: 'bg-orange-100 text-orange-800 border-orange-200',
    };
    return styles[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  // ✅ SAFE RENDER: Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.fullName || 'Artisan'}!
          </h1>
          <p className="text-gray-600">Here's your work overview</p>
        </div>
        <Link to="/jobs">
          <Button className="bg-emerald-500 hover:bg-emerald-600">
            <Briefcase className="w-4 h-4 mr-2" />
            Find Jobs
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalJobs}</div>
            <p className="text-xs text-muted-foreground">Jobs you've worked on</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Jobs</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeJobs}</div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <Star className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedJobs}</div>
            <p className="text-xs text-muted-foreground">Jobs completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Earnings</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.totalEarnings)}
            </div>
            <p className="text-xs text-muted-foreground">Lifetime earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Wallet Summary */}
      <Card className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-emerald-100 mb-1">Available Balance</p>
              <h2 className="text-3xl font-bold">
                {formatCurrency(wallet?.balance || 0)}
              </h2>
              {wallet?.pendingBalance && wallet.pendingBalance > 0 && (
                <p className="text-sm text-emerald-200 mt-1">
                  + {formatCurrency(wallet.pendingBalance)} pending
                </p>
              )}
            </div>
            <div className="flex gap-3">
              <Link to="/artisan/wallet">
                <Button variant="secondary" className="bg-white text-emerald-600 hover:bg-gray-100">
                  <Wallet className="w-4 h-4 mr-2" />
                  View Wallet
                </Button>
              </Link>
              <Link to="/artisan/wallet/withdraw">
                <Button variant="outline" className="border-white text-white hover:bg-emerald-700">
                  Withdraw
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Jobs</CardTitle>
          <Link to="/artisan/jobs">
            <Button variant="ghost" size="sm" className="text-emerald-600">
              View All
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {!recentJobs || recentJobs.length === 0 ? (
            <div className="text-center py-8">
              <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">You haven't taken any jobs yet</p>
              <Link to="/jobs">
                <Button className="bg-emerald-500 hover:bg-emerald-600">
                  Browse Available Jobs
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {recentJobs.map((job) => (
                <div
                  key={job?._id || Math.random()}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-semibold truncate">{job?.title || 'Untitled Job'}</h3>
                      <Badge className={getStatusBadge(job?.status || 'pending')}>
                        {getStatusLabel(job?.status || 'pending')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{job?.category || 'Uncategorized'}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(job?.budget || 0)} • {job?.scheduledDate ? formatDate(job.scheduledDate) : 'No date'}
                    </p>
                  </div>
                  <Link to={`/artisan/jobs/${job?._id || '#'}`} className="ml-4">
                    <Button variant="outline" size="sm">View</Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Find Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Browse available jobs and apply for work that matches your skills.
            </p>
            <Link to="/jobs">
              <Button variant="outline" className="w-full">
                Browse Jobs
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Check your messages and stay in touch with customers.
            </p>
            <Link to="/artisan/messages">
              <Button variant="outline" className="w-full">
                <MessageSquare className="w-4 h-4 mr-2" />
                View Messages
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ArtisanDashboard;