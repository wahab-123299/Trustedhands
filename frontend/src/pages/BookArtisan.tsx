import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, Clock, MapPin, Phone, MessageSquare, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { artisanApi, jobApi } from '@/services/api';
import { formatCurrency, getInitials } from '@/lib/utils';
import { toast } from 'sonner';

const BookArtisan = () => {
  const { artisanId } = useParams();
  const navigate = useNavigate();
  const [artisan, setArtisan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [bookingData, setBookingData] = useState({
    title: '',
    description: '',
    scheduledDate: '',
    scheduledTime: '',
    address: '',
    budget: '',
    phone: '',
    notes: '',
  });

  useEffect(() => {
    if (!artisanId) {
      toast.error('No artisan selected');
      navigate('/artisans');
      return;
    }
    fetchArtisan();
  }, [artisanId]);

  const fetchArtisan = async () => {
    try {
      setIsLoading(true);
      const response = await artisanApi.getById(artisanId as string);
      if (!response.data?.data?.artisan) {
        throw new Error('Artisan not found');
      }
      setArtisan(response.data.data.artisan);
      
      // Pre-fill budget with artisan's rate
      setBookingData(prev => ({
        ...prev,
        budget: response.data.data.artisan.hourlyRate?.toString() || ''
      }));
    } catch (error) {
      toast.error('Failed to load artisan details');
      navigate('/artisans');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!bookingData.scheduledDate || !bookingData.scheduledTime) {
      toast.error('Please select date and time');
      return;
    }

    setIsSubmitting(true);

    try {
      const jobData = {
        title: bookingData.title,
        description: bookingData.description,
        category: artisan?.profession || 'General',
        location: {
          state: artisan?.location?.state || 'Lagos',
          city: artisan?.location?.city || '',
          address: bookingData.address,
        },
        budget: parseFloat(bookingData.budget),
        scheduledDate: `${bookingData.scheduledDate}T${bookingData.scheduledTime}`,
        artisanId: artisanId,
        status: 'pending',
        phone: bookingData.phone,
        notes: bookingData.notes,
      };

      const response = await jobApi.create(jobData);
      
      toast.success('Booking request sent! The artisan will confirm shortly.');
      navigate('/customer/bookings');
    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.response?.data?.message || error.message || 'Failed to create booking');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!artisan) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Back Button */}
        <Button 
          variant="ghost" 
          className="mb-4"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Artisans
        </Button>

        {/* Artisan Summary */}
        <Card className="mb-6 border-emerald-200 bg-emerald-50/30">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xl">
                {getInitials(artisan.name)}
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-bold text-gray-900">{artisan.name}</h2>
                <p className="text-gray-600">{artisan.profession}</p>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <MapPin className="w-4 h-4" />
                  {artisan.location?.city}, {artisan.location?.state}
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(artisan.hourlyRate || 0)}
                </p>
                <p className="text-sm text-gray-500">/{artisan.ratePeriod || 'job'}</p>
                {artisan.isVerified && (
                  <Badge className="mt-2 bg-blue-100 text-blue-800">
                    ✓ Verified
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Booking Form */}
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-2xl">Book {artisan.name}</CardTitle>
            <p className="text-gray-500 text-sm mt-1">
              Fill in the details below to send a booking request
            </p>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Job Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  What do you need done? <span className="text-red-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g., Fix my kitchen sink, Paint living room"
                  value={bookingData.title}
                  onChange={(e) => setBookingData({ ...bookingData, title: e.target.value })}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Describe the job in detail <span className="text-red-500">*</span>
                </label>
                <Textarea
                  required
                  rows={4}
                  placeholder="Describe what needs to be done, materials needed, specific requirements, etc."
                  value={bookingData.description}
                  onChange={(e) => setBookingData({ ...bookingData, description: e.target.value })}
                />
              </div>

              {/* Date & Time */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Preferred Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="date"
                    required
                    min={new Date().toISOString().split('T')[0]}
                    value={bookingData.scheduledDate}
                    onChange={(e) => setBookingData({ ...bookingData, scheduledDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Preferred Time <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="time"
                    required
                    value={bookingData.scheduledTime}
                    onChange={(e) => setBookingData({ ...bookingData, scheduledTime: e.target.value })}
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Your Full Address <span className="text-red-500">*</span>
                </label>
                <Textarea
                  required
                  rows={2}
                  placeholder="House number, street, landmark, area..."
                  value={bookingData.address}
                  onChange={(e) => setBookingData({ ...bookingData, address: e.target.value })}
                />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Your Budget (₦) <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  required
                  min="500"
                  placeholder="Enter amount in Naira"
                  value={bookingData.budget}
                  onChange={(e) => setBookingData({ ...bookingData, budget: e.target.value })}
                />
                <p className="text-sm text-gray-500 mt-1">
                  Suggested: {formatCurrency(artisan.hourlyRate || 0)}/{artisan.ratePeriod}
                  {parseFloat(bookingData.budget) < (artisan.hourlyRate || 0) && (
                    <span className="text-orange-600 ml-2">
                      ⚠️ Below artisan's rate
                    </span>
                  )}
                </p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Contact Phone <span className="text-red-500">*</span>
                </label>
                <Input
                  type="tel"
                  required
                  placeholder="e.g., 08012345678"
                  value={bookingData.phone}
                  onChange={(e) => setBookingData({ ...bookingData, phone: e.target.value })}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  <MessageSquare className="w-4 h-4 inline mr-1" />
                  Additional Notes (Optional)
                </label>
                <Textarea
                  rows={2}
                  placeholder="Any special instructions, parking info, gate codes, etc."
                  value={bookingData.notes}
                  onChange={(e) => setBookingData({ ...bookingData, notes: e.target.value })}
                />
              </div>

              {/* Submit */}
              <div className="flex gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/artisans')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Sending...
                    </>
                  ) : (
                    'Confirm Booking'
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BookArtisan;