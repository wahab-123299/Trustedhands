import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Phone, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  MessageSquare,
  Star,
  Loader2,
  Filter,
  Search,
  MoreVertical,
  CalendarDays
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { jobApi } from '@/services/api';
import { Job } from '@/types';

interface BookingWithArtisan extends Job {
  artisanDetails?: {
    fullName: string;
    phone: string;
    profileImage?: string;
    averageRating?: number;
  };
}

const statusConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  pending: { 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200', 
    label: 'Pending Confirmation',
    icon: <Clock className="w-4 h-4" />
  },
  accepted: { 
    color: 'bg-blue-100 text-blue-800 border-blue-200', 
    label: 'Confirmed',
    icon: <CheckCircle className="w-4 h-4" />
  },
  in_progress: { 
    color: 'bg-purple-100 text-purple-800 border-purple-200', 
    label: 'In Progress',
    icon: <Loader2 className="w-4 h-4" />
  },
  completed: { 
    color: 'bg-green-100 text-green-800 border-green-200', 
    label: 'Completed',
    icon: <CheckCircle className="w-4 h-4" />
  },
  cancelled: { 
    color: 'bg-red-100 text-red-800 border-red-200', 
    label: 'Cancelled',
    icon: <XCircle className="w-4 h-4" />
  },
};

const CustomerBookings: React.FC = () => {
  const navigate = useNavigate();
  const {} = useAuth();
  
  const [bookings, setBookings] = useState<BookingWithArtisan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('upcoming');
  const [selectedBooking, setSelectedBooking] = useState<BookingWithArtisan | null>(null);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewData, setReviewData] = useState({ rating: 0, comment: '' });

  const fetchBookings = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await jobApi.getMyJobs({ status: 'accepted,in_progress,completed' });
      const jobs = response.data.data.jobs || [];
      
      // Enrich with artisan details
      const enrichedJobs = jobs.map((job: Job) => ({
        ...job,
        artisanDetails: typeof job.artisanId === 'object' ? {
          fullName: job.artisanId.fullName,
          phone: job.artisanId.phone,
          profileImage: job.artisanId.profileImage,
          averageRating: job.artisanId.averageRating,
        } : undefined,
      }));
      
      setBookings(enrichedJobs);
    } catch (error: any) {
      toast.error('Failed to load bookings');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const filteredBookings = bookings.filter((booking) => {
    const matchesSearch = 
      booking.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.artisanDetails?.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      booking.category.toLowerCase().includes(searchTerm.toLowerCase());

    const today = new Date();
    const scheduledDate = new Date(booking.scheduledDate);
    
    switch (activeTab) {
      case 'upcoming':
        return matchesSearch && 
          ['accepted', 'in_progress'].includes(booking.status) && 
          scheduledDate >= today;
      case 'past':
        return matchesSearch && 
          (booking.status === 'completed' || scheduledDate < today);
      case 'cancelled':
        return matchesSearch && booking.status === 'cancelled';
      default:
        return matchesSearch;
    }
  });

  const handleCancel = async () => {
    if (!selectedBooking || !cancelReason.trim()) return;
    
    try {
      setIsProcessing(true);
      await jobApi.cancel(selectedBooking._id, cancelReason);
      toast.success('Booking cancelled successfully');
      setIsCancelDialogOpen(false);
      setCancelReason('');
      fetchBookings();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to cancel booking');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!selectedBooking || reviewData.rating === 0) {
      toast.error('Please provide a rating');
      return;
    }
    
    try {
      setIsProcessing(true);
      await jobApi.addReview(selectedBooking._id, reviewData);
      toast.success('Review submitted successfully');
      setReviewDialogOpen(false);
      setReviewData({ rating: 0, comment: '' });
      fetchBookings();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to submit review');
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const getDaysUntil = (dateString: string) => {
    const days = Math.ceil((new Date(dateString).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return 'Overdue';
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days} days`;
  };

  const renderStars = (rating: number, interactive = false, onRate?: (r: number) => void) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => interactive && onRate?.(star)}
            className={`${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'} transition-transform`}
            disabled={!interactive}
          >
            <Star
              className={`w-6 h-6 ${
                star <= rating
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'fill-gray-200 text-gray-200'
              }`}
            />
          </button>
        ))}
      </div>
    );
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
          <h1 className="text-2xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-gray-600">Manage your scheduled services</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search bookings by service or artisan..."
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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 lg:w-[400px]">
          <TabsTrigger value="upcoming">
            Upcoming ({bookings.filter(b => ['accepted', 'in_progress'].includes(b.status)).length})
          </TabsTrigger>
          <TabsTrigger value="past">Past</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {filteredBookings.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm ? 'Try adjusting your search' : 'You have no bookings in this category'}
                </p>
                <Button 
                  onClick={() => navigate('/artisans')}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Find an Artisan
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredBookings.map((booking) => {
                const { date, time } = formatDateTime(booking.scheduledDate);
                const status = statusConfig[booking.status];
                
                return (
                  <Card key={booking._id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row">
                        {/* Date Column */}
                        <div className="bg-emerald-50 p-6 lg:w-48 flex flex-row lg:flex-col items-center lg:justify-center gap-4 lg:gap-2 border-b lg:border-b-0 lg:border-r border-emerald-100">
                          <Calendar className="w-8 h-8 text-emerald-600 lg:hidden" />
                          <div className="text-center lg:text-left">
                            <p className="text-2xl font-bold text-emerald-700">{date.split(' ')[2]}</p>
                            <p className="text-sm text-emerald-600 uppercase font-medium">{date.split(' ')[1]}</p>
                            <p className="text-xs text-emerald-500">{date.split(' ')[0]}</p>
                          </div>
                          <div className="lg:hidden flex-1 text-right">
                            <Badge className={status.color}>
                              <span className="flex items-center gap-1">
                                {status.icon}
                                {status.label}
                              </span>
                            </Badge>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="hidden lg:flex items-center gap-2 mb-2">
                                <Badge className={status.color}>
                                  <span className="flex items-center gap-1">
                                    {status.icon}
                                    {status.label}
                                  </span>
                                </Badge>
                                {['accepted', 'in_progress'].includes(booking.status) && (
                                  <span className="text-sm text-orange-600 font-medium">
                                    {getDaysUntil(booking.scheduledDate)}
                                  </span>
                                )}
                              </div>
                              
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {booking.title}
                              </h3>
                              <p className="text-sm text-gray-600 mb-3">{booking.category}</p>

                              {/* Artisan Info */}
                              {booking.artisanDetails && (
                                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-semibold">
                                    {booking.artisanDetails.profileImage ? (
                                      <img 
                                        src={booking.artisanDetails.profileImage} 
                                        alt={booking.artisanDetails.fullName}
                                        className="w-full h-full rounded-full object-cover"
                                      />
                                    ) : (
                                      booking.artisanDetails.fullName.charAt(0)
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">
                                      {booking.artisanDetails.fullName}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                      <Phone className="w-3 h-3" />
                                      {booking.artisanDetails.phone}
                                    </div>
                                  </div>
                                  {booking.artisanDetails.averageRating && (
                                    <div className="flex items-center gap-1 text-sm">
                                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                                      {booking.artisanDetails.averageRating.toFixed(1)}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/customer/jobs/${booking._id}`)}>
                                  View Details
                                </DropdownMenuItem>
                                
                                {booking.artisanDetails && (
                                  <DropdownMenuItem onClick={() => navigate(`/customer/messages?artisanId=${booking.artisanId}`)}>
                                    <MessageSquare className="w-4 h-4 mr-2" />
                                    Message Artisan
                                  </DropdownMenuItem>
                                )}
                                
                                {['accepted', 'in_progress'].includes(booking.status) && (
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={() => {
                                      setSelectedBooking(booking);
                                      setIsCancelDialogOpen(true);
                                    }}
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Cancel Booking
                                  </DropdownMenuItem>
                                )}
                                
                                {booking.status === 'completed' && !booking.review && (
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedBooking(booking);
                                    setReviewDialogOpen(true);
                                  }}>
                                    <Star className="w-4 h-4 mr-2" />
                                    Leave Review
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          {/* Footer Info */}
                          <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {time}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="w-4 h-4" />
                              {booking.location?.city}
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              ₦{booking.budget?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <Dialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Booking</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this booking? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Reason for cancellation</label>
            <Textarea
              placeholder="Please provide a reason..."
              value={cancelReason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCancelReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCancelDialogOpen(false)}>
              Keep Booking
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel}
              disabled={!cancelReason.trim() || isProcessing}
            >
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cancel Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate Your Experience</DialogTitle>
            <DialogDescription>
              How was your service with {selectedBooking?.artisanDetails?.fullName}?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="flex justify-center">
              {renderStars(reviewData.rating, true, (r) => setReviewData({ ...reviewData, rating: r }))}
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Your review (optional)</label>
              <Textarea
                placeholder="Share your experience..."
                value={reviewData.comment}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReviewData({ ...reviewData, comment: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">{reviewData.comment.length}/500</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)}>
              Skip
            </Button>
            <Button 
              onClick={handleSubmitReview}
              disabled={reviewData.rating === 0 || isProcessing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isProcessing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerBookings;