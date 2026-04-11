import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  DollarSign, 
  Clock,
  MessageSquare,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { jobApi, paymentApi } from '@/services/api';
import { Job } from '@/types';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};

const JobDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {} = useSocket();
  
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (id) {
      fetchJobDetails();
    }
  }, [id]);

  const fetchJobDetails = async () => {
    try {
      setIsLoading(true);
      const response = await jobApi.getById(id!);
      setJob(response.data.data.job);
    } catch (error: any) {
      toast.error('Failed to load job details');
      navigate('/customer/jobs');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!job) return;
    
    try {
      setIsProcessing(true);
      const response = await paymentApi.initialize({
        jobId: job._id,
        email: user?.email
      });
      
      // Redirect to Paystack checkout
      if (response.data.data.authorization_url) {
        window.location.href = response.data.data.authorization_url;
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to initialize payment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!job) return;
    
    try {
      setIsProcessing(true);
      await jobApi.confirmCompletion(job._id);
      toast.success('Job marked as complete!');
      fetchJobDetails();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to confirm completion');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!job) return;
    
    try {
      setIsProcessing(true);
      await jobApi.cancel(job._id, 'Cancelled by customer');
      toast.success('Job cancelled');
      fetchJobDetails();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to cancel job');
    } finally {
      setIsProcessing(false);
    }
  };

  const startChat = () => {
    if (job?.artisanId && typeof job.artisanId === 'object') {
      navigate(`/customer/messages?artisanId=${job.artisanId._id}`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Job not found</p>
        <Button onClick={() => navigate('/customer/jobs')} className="mt-4">
          Back to Jobs
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/customer/jobs')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
          <p className="text-gray-600">Job Details</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge className={statusColors[job.status]}>
                  {job.status.toUpperCase()}
                </Badge>
                <span className="text-sm text-gray-500">
                  Posted {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Description</h3>
                <p className="text-gray-600 whitespace-pre-wrap">{job.description}</p>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Budget</p>
                    <p className="font-semibold">₦{job.budget?.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Scheduled</p>
                    <p className="font-semibold">
                      {new Date(job.scheduledDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-semibold">{job.location?.city}, {job.location?.state}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <p className="font-semibold">{job.category}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Artisan Card */}
          {job.artisanId && (
            <Card>
              <CardHeader>
                <CardTitle>Assigned Artisan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center text-2xl font-bold text-emerald-700">
                    {typeof job.artisanId === 'object' 
                      ? job.artisanId.fullName?.charAt(0)
                      : 'A'
                    }
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">
                      {typeof job.artisanId === 'object' 
                        ? job.artisanId.fullName
                        : 'Artisan'
                      }
                    </h3>
                    <p className="text-gray-600">
                      {typeof job.artisanId === 'object' 
                        ? job.artisanId.phone
                        : ''
                      }
                    </p>
                  </div>
                  <Button variant="outline" onClick={startChat}>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Message
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Actions */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {job.status === 'pending' && job.paymentStatus === 'pending' && (
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={handlePayment}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <DollarSign className="w-4 h-4 mr-2" />
                  )}
                  Pay Now
                </Button>
              )}

              {job.status === 'completed' && job.paymentStatus === 'paid' && (
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleConfirmCompletion}
                  disabled={isProcessing}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm Completion
                </Button>
              )}

              {['pending', 'accepted'].includes(job.status) && (
                <Button 
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  onClick={handleCancel}
                  disabled={isProcessing}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Job
                </Button>
              )}

              {job.artisanId && (
                <Button 
                  variant="outline"
                  className="w-full"
                  onClick={startChat}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Chat with Artisan
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Payment Status */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge 
                variant={job.paymentStatus === 'paid' ? 'default' : 'secondary'}
                className="w-full justify-center py-2"
              >
                {job.paymentStatus === 'paid' ? '✓ Paid' : '⏳ Pending Payment'}
              </Badge>
              {job.paymentStatus === 'paid' && job.transactionId && (
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Transaction ID: {typeof job.transactionId === 'string' 
                    ? job.transactionId.slice(-8) 
                    : '...'}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default JobDetails;