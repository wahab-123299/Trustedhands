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
  CheckCircle,
  Building2,
  ChevronRight,
  ThumbsUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { jobApi } from '@/services/api';
import { Job } from '@/types';

interface JobApplication {
  jobId: string;
  coverLetter: string;
  proposedRate?: number;
}

const ArtisanJobs: React.FC = () => {
  const navigate = useNavigate();
  const { user, artisanProfile } = useAuth();
  
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);
  const [myApplications, setMyApplications] = useState<Job[]>([]);
  const [myJobs, ] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('available');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [applicationData, setApplicationData] = useState<JobApplication>({
    jobId: '',
    coverLetter: '',
    proposedRate: undefined
  });

  useEffect(() => {
    fetchAllJobs();
  }, []);

  const fetchAllJobs = async () => {
    try {
      setIsLoading(true);
      
      // Fetch available jobs (open jobs matching artisan skills)
      const availableRes = await jobApi.getAll({ 
        status: 'pending',
        category: artisanProfile?.skills?.join(',')
      });
      setAvailableJobs(availableRes.data.data.jobs || []);

      // Fetch my applications
      const applicationsRes = await jobApi.getMyJobs();
      const allMyJobs = applicationsRes.data.data.jobs || [];
      
      setMyApplications(allMyJobs.filter((j: Job) => j.status === 'pending' && j.applications?.some((a: any) => a.artisanId === user?._id)
    ));
      
    } catch (error: any) {
      toast.error('Failed to load jobs');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApply = async () => {
    if (!selectedJob || !applicationData.coverLetter.trim()) {
      toast.error('Please write a cover letter');
      return;
    }

    try {
      setIsApplying(true);
      await jobApi.apply(selectedJob._id, {
        coverLetter: applicationData.coverLetter,
        proposedRate: applicationData.proposedRate
      });
      
      toast.success('Application submitted successfully!');
      setSelectedJob(null);
      setApplicationData({ jobId: '', coverLetter: '', proposedRate: undefined });
      fetchAllJobs();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to apply');
    } finally {
      setIsApplying(false);
    }
  };

  const canApply = (job: Job) => {
    if (!artisanProfile) return false;
    
    // Check if already applied
    if (job.applications?.some((a: any) => a.artisanId === user?._id)) return false;  // ✅ 
    // Check if skills match
    const jobCategory = job.category.toLowerCase();
    const hasMatchingSkill = artisanProfile.skills?.some(
      skill => skill.toLowerCase().includes(jobCategory) || jobCategory.includes(skill.toLowerCase())
    );
    
    // Check experience level for budget
    const minRates: Record<string, number> = {
      '0-1': 5000,
      '1-3': 10000,
      '3-5': 20000,
      '5-10': 50000,
      '10+': 100000
    };
    
    const minRate = minRates[artisanProfile.experienceYears || '0-1'] || 5000;
    const canAfford = job.budget >= minRate;
    
    return hasMatchingSkill && canAfford;
  };

  const getApplyButtonText = (job: Job) => {
    if (job.applications?.some((app: any) => app.artisanId === user?._id)) {
      return 'Already Applied';
    }
    if (!artisanProfile?.skills?.some(s => s.toLowerCase().includes(job.category.toLowerCase()))) {
      return 'Skills Don\'t Match';
    }
    return 'Apply Now';
  };

  const filteredJobs = availableJobs.filter(job => 
    job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    job.location?.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-NG', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysAgo = (dateString: string) => {
    const days = Math.floor((Date.now() - new Date(dateString).getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
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
          <h1 className="text-2xl font-bold text-gray-900">Find Jobs</h1>
          <p className="text-gray-600">Browse and apply for available work</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Building2 className="w-4 h-4" />
          <span>Your Rate: ₦{artisanProfile?.rate?.amount?.toLocaleString()}/{artisanProfile?.rate?.period}</span>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search jobs by title, location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button variant="outline">
          <Filter className="w-4 h-4 mr-2" />
          Filter
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-emerald-600">{availableJobs.length}</p>
            <p className="text-sm text-gray-600">Available Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-blue-600">{myApplications.length}</p>
            <p className="text-sm text-gray-600">My Applications</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-2xl font-bold text-purple-600">{myJobs.length}</p>
            <p className="text-sm text-gray-600">Active Jobs</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="available">
            Available ({availableJobs.length})
          </TabsTrigger>
          <TabsTrigger value="applications">
            Applications ({myApplications.length})
          </TabsTrigger>
          <TabsTrigger value="myjobs">
            My Jobs ({myJobs.length})
          </TabsTrigger>
        </TabsList>

        {/* Available Jobs */}
        <TabsContent value="available" className="mt-6">
          {filteredJobs.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs available</h3>
                <p className="text-gray-500 mb-4">Check back later for new opportunities</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredJobs.map((job) => (
                <Card key={job._id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col lg:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge className="bg-emerald-100 text-emerald-800">
                              {job.category}
                            </Badge>
                            <h3 className="text-lg font-semibold text-gray-900 mt-2">
                              {job.title}
                            </h3>
                            <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                              {job.description}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {getDaysAgo(job.createdAt)}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {job.location?.city}, {job.location?.state}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {formatDate(job.scheduledDate)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {Math.ceil((new Date(job.scheduledDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days to go
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

                        <Button 
                          className="w-full"
                          disabled={!canApply(job)}
                          onClick={() => {
                            setSelectedJob(job);
                            setApplicationData({
                              jobId: job._id,
                              coverLetter: `Dear Client,\n\nI am interested in your ${job.category} job. With my ${artisanProfile?.experienceYears} years of experience, I am confident I can deliver excellent results.\n\nBest regards,\n${user?.fullName}`,
                              proposedRate: job.budget
                            });
                          }}
                        >
                          {canApply(job) ? (
                            <>
                              <ThumbsUp className="w-4 h-4 mr-2" />
                              Apply Now
                            </>
                          ) : (
                            getApplyButtonText(job)
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Applications */}
        <TabsContent value="applications" className="mt-6">
          {myApplications.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <p className="text-gray-500">You haven't applied to any jobs yet</p>
                <Button 
                  onClick={() => setActiveTab('available')} 
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700"
                >
                  Browse Jobs
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myApplications.map((job) => (
                <Card key={job._id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{job.title}</h3>
                        <p className="text-sm text-gray-600">{job.category}</p>
                      </div>
                      <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* My Jobs */}
        <TabsContent value="myjobs" className="mt-6">
          {myJobs.length === 0 ? (
            <Card className="text-center py-16">
              <CardContent>
                <p className="text-gray-500">No active jobs</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {myJobs.map((job) => (
                <Card 
                  key={job._id} 
                  className="cursor-pointer hover:shadow-md"
                  onClick={() => navigate(`/artisan/jobs/${job._id}`)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Badge className={
                          job.status === 'in_progress' ? 'bg-purple-100 text-purple-800' :
                          job.status === 'completed' ? 'bg-green-100 text-green-800' :
                          'bg-blue-100 text-blue-800'
                        }>
                          {job.status.replace('_', ' ')}
                        </Badge>
                        <h3 className="font-semibold mt-2">{job.title}</h3>
                        <p className="text-sm text-gray-600">₦{job.budget?.toLocaleString()}</p>
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

      {/* Apply Dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply for Job</DialogTitle>
            <DialogDescription>
              {selectedJob?.title}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Budget: ₦{selectedJob?.budget?.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Location: {selectedJob?.location?.city}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium">Cover Letter</label>
              <Textarea
                value={applicationData.coverLetter}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => 
                    setApplicationData(prev => ({ ...prev, coverLetter: e.target.value }))
                }
                rows={5}
                placeholder="Introduce yourself and explain why you're perfect for this job..."
              />
            </div>

            <div>
              <label className="text-sm font-medium">Your Proposed Rate (₦)</label>
              <Input
                type="number"
                value={applicationData.proposedRate || ''}
                onChange={(e) => setApplicationData(prev => ({ ...prev, proposedRate: parseInt(e.target.value) }))}
                placeholder={selectedJob?.budget?.toString()}
              />
              <p className="text-xs text-gray-500 mt-1">Leave blank to accept the budget</p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedJob(null)}>
                Cancel
              </Button>
              <Button 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleApply}
                disabled={isApplying || !applicationData.coverLetter.trim()}
              >
                {isApplying ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Submit Application
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ArtisanJobs;