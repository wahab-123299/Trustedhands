import { Link } from 'react-router-dom';
import { MapPin, Star, Briefcase } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ArtisanProfile } from '@/types';
import { formatCurrency, getInitials } from '@/lib/utils';

interface ArtisanCardProps {
  artisan: ArtisanProfile;
}

const ArtisanCard = ({ artisan }: ArtisanCardProps) => {
  const user = artisan.user;
  
  if (!user) return null;

  const getAvailabilityBadge = (status: string) => {
    switch (status) {
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

  return (
    <Card className="hover:shadow-lg transition-shadow overflow-hidden">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={user.profileImage} alt={user.fullName} />
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-lg">
              {getInitials(user.fullName)}
            </AvatarFallback>
          </Avatar>
          <Badge className={getAvailabilityBadge(artisan.availability.status)}>
            {artisan.availability.status}
          </Badge>
        </div>

        {/* Info */}
        <div className="mb-4">
          <h3 className="font-semibold text-lg text-gray-900">{user.fullName}</h3>
          <div className="flex items-center gap-1 text-gray-500 text-sm mt-1">
            <MapPin className="w-4 h-4" />
            {user.location.city}, {user.location.state}
          </div>
        </div>

        {/* Skills */}
        <div className="flex flex-wrap gap-1 mb-4">
          {artisan.skills.slice(0, 3).map((skill) => (
            <Badge key={skill} variant="secondary" className="text-xs">
              {skill}
            </Badge>
          ))}
          {artisan.skills.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{artisan.skills.length - 3}
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between mb-4 text-sm">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="font-medium">{artisan.averageRating.toFixed(1)}</span>
            <span className="text-gray-500">({artisan.totalReviews})</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <Briefcase className="w-4 h-4" />
            {artisan.completedJobs} jobs
          </div>
        </div>

        {/* Rate */}
        <div className="mb-4">
          <span className="text-lg font-bold text-emerald-600">
            {formatCurrency(artisan.rate.amount)}
          </span>
          <span className="text-gray-500 text-sm">/{artisan.rate.period}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link to={`/artisans/${user._id}`} className="flex-1">
            <Button variant="outline" className="w-full">View Profile</Button>
          </Link>
          <Link to={`/customer/post-job/${user._id}`} className="flex-1">
            <Button className="w-full bg-emerald-500 hover:bg-emerald-600">Book Now</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};

export default ArtisanCard;
