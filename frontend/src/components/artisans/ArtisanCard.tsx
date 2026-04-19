import { Link } from 'react-router-dom';
import { MapPin, Star, Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency, getInitials } from '@/lib/utils';

interface ArtisanCardProps {
  artisan: {
    id: string;
    name?: string;
    email?: string;
    phone?: string;
    profileImage?: string;
    location?: {
      city?: string;
      state?: string;
    };
    profession?: string;
    skills?: string[];
    hourlyRate?: number;
    ratePeriod?: string;
    isAvailable?: boolean;
    availabilityStatus?: string;
    rating?: number;
    reviewCount?: number;
    completedJobs?: number;
    isVerified?: boolean;
    userId?: string;
  };
}

const ArtisanCard = ({ artisan }: ArtisanCardProps) => {
  if (!artisan || !artisan.id) {
    console.warn('ArtisanCard: Invalid artisan data', artisan);
    return null;
  }

  const {
    id,
    name = 'Unknown',
    profileImage,
    location = {},
    profession = 'Artisan',
    skills = [],
    hourlyRate = 0,
    ratePeriod = 'job',
    availabilityStatus = 'unavailable',
    rating = 0,
    reviewCount = 0,
    completedJobs = 0,
    userId = id,
  } = artisan;

  const { city = 'Unknown', state = '' } = location || {};

  const getAvailabilityBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'busy':
        return 'bg-yellow-100 text-yellow-800';
      case 'unavailable':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
  };

  // ✅ FIXED: Use artisan.id for booking, not userId (more reliable)
  const bookingUrl = `/book/${artisan.id}`;

  return (
    <Card className="hover:shadow-lg transition-shadow overflow-hidden">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <Avatar className="w-16 h-16">
            <AvatarImage 
              src={profileImage} 
              alt={name} 
              onError={handleImageError}
            />
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-lg">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <Badge className={getAvailabilityBadge(availabilityStatus)}>
            {availabilityStatus || 'Unknown'}
          </Badge>
        </div>

        {/* Info */}
        <div className="mb-4">
          <h3 className="font-semibold text-lg text-gray-900">{name}</h3>
          <p className="text-sm text-gray-600">{profession}</p>
          <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
            <MapPin className="w-4 h-4" />
            {city}{state ? `, ${state}` : ''}
          </div>
        </div>

        {/* Skills */}
        {skills && skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {skills.slice(0, 3).map((skill, index) => (
              <Badge key={`${skill}-${index}`} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
            {skills.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{skills.length - 3}
              </Badge>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between mb-4 text-sm">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="font-medium">{rating?.toFixed(1) || '0.0'}</span>
            <span className="text-gray-500">({reviewCount || 0})</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <Briefcase className="w-4 h-4" />
            {completedJobs || 0} jobs
          </div>
        </div>

        {/* Rate */}
        <div className="mb-4">
          <span className="text-lg font-bold text-emerald-600">
            {formatCurrency(hourlyRate || 0)}
          </span>
          <span className="text-gray-500 text-sm">/{ratePeriod || 'job'}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link to={`/artisans/${artisan.id}`} className="flex-1">
            <Button variant="outline" className="w-full">View Profile</Button>
          </Link>
          {/* ✅ FIXED: Use Link to /book/:id route */}
          <Link to={bookingUrl} className="flex-1">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600">Book Now</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default ArtisanCard;