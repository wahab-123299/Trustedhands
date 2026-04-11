import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Calendar, MessageSquare, Star, TrendingUp, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { jobApi } from '@/services/api';
import { Job } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const CustomerDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    pendingJobs: 0,
  });
  const [recentJobs, setRecentJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const response = await jobApi.getMyJobs({ limit: 5 });
      
      // ✅ SAFE EXTRACTION
      const jobs = response?.data?.data?.jobs || [];

      setRecentJobs(jobs);
      
      // ✅ SAFE STATS CALCULATION with optional chaining
      setStats({
        totalJobs: jobs?.length || 0,
        activeJobs: jobs?.filter((job) => job?.status === 'accepted' || job?.status === 'in_progress').length || 0,
        completedJobs: jobs?.filter((job) => job?.status === 'completed').length || 0,
        pendingJobs: jobs?.filter((job) => job?.status === 'pending').length || 0,
      });
      
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // ✅ SAFE DEFAULTS on error
      setRecentJobs([]);
      setStats({
        totalJobs: 0,
        activeJobs: 0,
        completedJobs: 0,
        pendingJobs: 0,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      accepted: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-purple-100 text-purple-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  // ✅ LOADING STATE
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {user?.fullName || 'Customer'}!
          </h1>
          <p className="text-gray-600">Here's what's happening with your jobs</p>
        </div>
        <Link to="/customer/post-job">
          <Button className="bg-emerald-500 hover:bg-emerald-600">
            <Plus className="w-4 h-4 mr-2" />
            Post a Job
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
            <p className="text-xs text-muted-foreground">All time jobs posted</p>
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
            <Calendar className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedJobs}</div>
            <p className="text-xs text-muted-foreground">Jobs completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Star className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingJobs}</div>
            <p className="text-xs text-muted-foreground">Awaiting response</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Jobs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent Jobs</CardTitle>
          <Link to="/customer/jobs">
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
              <p className="text-gray-500 mb-4">You haven't posted any jobs yet</p>
              <Link to="/customer/post-job">
                <Button className="bg-emerald-500 hover:bg-emerald-600">
                  Post Your First Job
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
                        {(job?.status || 'pending').replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">{job?.category || 'Uncategorized'}</p>
                    <p className="text-sm text-gray-500">
                      {formatCurrency(job?.budget || 0)} • {job?.scheduledDate ? formatDate(job.scheduledDate) : 'No date set'}
                    </p>
                  </div>
                  <Link to={`/customer/jobs/${job?._id || '#'}`} className="ml-4">
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
            <CardTitle>Find Artisans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600 mb-4">
              Browse our verified artisans and find the perfect match for your needs.
            </p>
            <Link to="/artisans">
              <Button variant="outline" className="w-full">
                Browse Artisans
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
              Check your messages and stay in touch with artisans.
            </p>
            <Link to="/customer/messages">
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

export default CustomerDashboard;