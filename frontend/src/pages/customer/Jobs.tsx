import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Briefcase, 
  MapPin, 
  Calendar, 
  Clock,
  Filter,
  Search,
  Loader2,
  Plus,
  XCircle,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { jobApi } from '@/services/api';
import { Job } from '@/types';

const CustomerJobs: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // ✅ FIXED: Only show customer's own jobs
  const [myPostedJobs, setMyPostedJobs] = useState<Job[]>([]); // Jobs I posted (pending/open)
  const [myActiveJobs, setMyActiveJobs] = useState<Job[]>([]); // Jobs I posted (in progress/completed)
  const [availableArtisans, setAvailableArtisans] = useState<any[]>([]); // Available artisans to book
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('posted');
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyJobs();
  }, []);

  // ✅ FIXED: Fetch only MY jobs (where I'm the customer)
  const fetchMyJobs = async () => {
    try {
      setIsLoading(true);
      
      // Fetch ONLY my jobs (where I'm the customer)
      const myJobsRes = await jobApi.getMyJobs();
      const allMyJobs = myJobsRes.data.data.jobs || [];
      
      // ✅ Filter to ensure only MY jobs (customerId matches my user ID)
      const myJobsOnly = allMyJobs.filter((j: Job) => {
        const jobCustomerId = typeof j.customerId === 'string' ? j.customerId : j.customerId?._id;
        return jobCustomerId === user?._id;
      });
      
      // Separate by status
      setMyPostedJobs(myJobsOnly.filter((j: Job) => 
        ['pending', 'open', 'assigned'].includes(j.status)
      ));
      
      setMyActiveJobs(myJobsOnly.filter((j: Job) => 
        ['in_progress', 'completed', 'cancelled'].includes(j.status)
      ));
      
    } catch (error: any) {
      toast.error('Failed to load your jobs');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Cancel job - only for jobs I posted
  const handleCancelJob = async (jobId: string) => {
    try {
      setCancellingJobId(jobId);
      await jobApi.cancel(jobId, 'Cancelled by customer');
      toast.success('Job cancelled successfully');
      fetchMyJobs(); // Refresh
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to cancel job');
    } finally {
      setCancellingJobId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      'pending': 'bg-amber-100 text-amber-800',
      'open': 'bg-blue-100 text-blue-800',
      'assigned': 'bg-purple-100 text-purple-800',
      'in_progress': 'bg-orange-100 text-orange-800',
      'completed': 'bg-green-100 text-green-800',
      'cancelled': 'bg-red-100 text-red-800'
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Jobs</h1>
          <p className="text-gray-600">Manage your posted jobs and find artisans</p>
        </div>
        <Button onClick={() => navigate('/jobs/create')} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          Post New Job
        </Button>
      </div>

      {/* Stats Cards - Only MY jobs */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-amber-600">{myPostedJobs.length}</p>
            <p className="text-sm text-gray-600">Posted Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{myActiveJobs.filter(j => j.status === 'in_progress').length}</p>
            <p className="text-sm text-gray-600">In Progress</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-green-600">{myActiveJobs.filter(j => j.status === 'completed').length}</p>
            <p className="text-sm text-gray-600">Completed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="posted">
            My Posted Jobs ({myPostedJobs.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Active/Completed ({myActiveJobs.length})
          </TabsTrigger>
        </TabsList>

        {/* My Posted Jobs - Can Cancel These */}
        <TabsContent value="posted" className="mt-6">
          {myPostedJobs.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No posted jobs</h3>
                <p className="text-gray-500 mb-4">Jobs you post will appear here</p>
                <Button onClick={() => navigate('/jobs/create')} className="bg-emerald-600 hover:bg-emerald-700">
                  Post a Job
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myPostedJobs.map((job) => (
                <Card key={job._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge className={getStatusBadge(job.status)}>
                              {job.status.toUpperCase()}
                            </Badge>
                            <h3 className="text-lg font-semibold text-gray-900 mt-2">
                              {job.title}
                            </h3>
                            <p className="text-gray-600 text-sm mt-1">
                              {job.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.location?.city}, {job.location?.state}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(job.scheduledDate || job.createdAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-4 h-4" />
                            {job.applications?.length || 0} applications
                          </span>
                        </div>
                      </div>

                      <div className="lg:w-64 space-y-3">
                        <div className="text-center p-4 bg-emerald-50 rounded-lg">
                          <p className="text-2xl font-bold text-emerald-700">
                            ₦{job.budget?.toLocaleString()}
                          </p>
                          <p className="text-sm text-emerald-600">Budget</p>
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            variant="outline"
                            className="flex-1"
                            onClick={() => navigate(`/jobs/${job._id}`)}
                          >
                            View Details
                          </Button>
                          
                          {/* ✅ CANCEL BUTTON - Only for my posted jobs that can be cancelled */}
                          {['pending', 'open', 'assigned'].includes(job.status) && (
                            <Button 
                              variant="destructive"
                              className="flex-1"
                              disabled={cancellingJobId === job._id}
                              onClick={() => handleCancelJob(job._id)}
                            >
                              {cancellingJobId === job._id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="w-4 h-4 mr-1" />
                                  Cancel
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Active/Completed Jobs - Cannot Cancel These */}
        <TabsContent value="active" className="mt-6">
          {myActiveJobs.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No active jobs</h3>
                <p className="text-gray-500">Jobs in progress or completed will appear here</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myActiveJobs.map((job) => (
                <Card 
                  key={job._id} 
                  className="cursor-pointer hover:shadow-md"
                  onClick={() => navigate(`/jobs/${job._id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className={getStatusBadge(job.status)}>
                          {job.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                        <h3 className="font-semibold mt-2">{job.title}</h3>
                        <p className="text-sm text-gray-600">₦{job.budget?.toLocaleString()}</p>
                        <p className="text-sm text-gray-500 mt-1">
                          Artisan: {typeof job.artisanId === 'object' ? job.artisanId?.fullName || 'Assigned' : 'Assigned'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomerJobs;