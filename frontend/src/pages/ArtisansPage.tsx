import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, MapPin, Filter, X, Loader2, Star, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { artisanApi } from '@/services/api';
import { toast } from 'sonner';

// Nigerian States
const NIGERIAN_STATES = [
  'All States', 'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 
  'Benue', 'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 
  'FCT', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 
  'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara'
];

const SKILL_CATEGORIES = [
  'All Skills', 'Electrician', 'Plumber', 'Carpenter', 'Painter', 'Mechanic', 
  'Tailor', 'Hair Stylist', 'Chef', 'Cleaner', 'Driver', 'Photographer', 
  'Welder', 'Bricklayer', 'HVAC Technician', 'Gardener', 'Security Guard'
];

// Safe artisan interface - handles both populated and unpopulated data
interface SafeArtisan {
  id: string;
  _id?: string;
  name?: string;
  fullName?: string;
  profession?: string;
  skills?: string[];
  averageRating?: number;
  totalReviews?: number;
  completedJobs?: number;
  location?: {
    city?: string;
    state?: string;
  };
  profileImage?: string;
  rate?: {
    amount?: number;
    period?: string;
  };
  isCertified?: boolean;
  availabilityStatus?: string;
  isAvailable?: boolean;
  userId?: string | { _id?: string; fullName?: string };
  hourlyRate?: number;
  ratePeriod?: string;
  rating?: number;
  reviewCount?: number;
}

const ArtisansPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [artisans, setArtisans] = useState<SafeArtisan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0,
  });

  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    state: searchParams.get('state') || 'All States',
    skills: searchParams.get('skills') || 'All Skills',
    availability: searchParams.get('availability') || 'all',
    minRating: searchParams.get('minRating') || 'all',
    maxRate: searchParams.get('maxRate') || 'all',
    experienceYears: searchParams.get('experienceYears') || 'all',
    sortBy: searchParams.get('sortBy') || 'rating',
  });

  // Fetch artisans
  const fetchArtisans = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy: filters.sortBy,
      };

      if (filters.state && filters.state !== 'All States') params.state = filters.state;
      if (filters.skills && filters.skills !== 'All Skills') params.skills = filters.skills;
      if (filters.availability && filters.availability !== 'all') params.availability = filters.availability;
      if (filters.minRating && filters.minRating !== 'all') params.minRating = filters.minRating;
      if (filters.maxRate && filters.maxRate !== 'all') params.maxRate = filters.maxRate;
      if (filters.experienceYears && filters.experienceYears !== 'all') params.experienceYears = filters.experienceYears;

      let response;
      if (filters.q) {
        response = await artisanApi.search(filters.q, params);
      } else {
        response = await artisanApi.getAll(params);
      }

      // ==========================================
      // DEBUG: Log the full response structure
      // ==========================================
      console.log('=== FRONTEND API RESPONSE ===');
      console.log('response:', response);
      console.log('response.data:', response.data);
      console.log('response.data?.data:', response.data?.data);
      console.log('response.data?.data?.artisans:', response.data?.data?.artisans);
      console.log('Type of artisans:', typeof response.data?.data?.artisans);
      console.log('Is Array:', Array.isArray(response.data?.data?.artisans));
      console.log('=== END DEBUG ===');

      // ==========================================
      // FIXED: Robust extraction with multiple fallbacks
      // ==========================================
      let rawArtisans: any[] = [];
      
      if (response.data && typeof response.data === 'object') {
        // Try nested structure first: { data: { artisans: [...] } }
        if (response.data.data && typeof response.data.data === 'object') {
          if (Array.isArray(response.data.data.artisans)) {
            rawArtisans = response.data.data.artisans;
            console.log('✅ Extracted from response.data.data.artisans, count:', rawArtisans.length);
          } else if (Array.isArray(response.data.data)) {
            // Fallback: { data: [...] } array directly
            rawArtisans = response.data.data;
            console.log('✅ Extracted from response.data.data (array), count:', rawArtisans.length);
          }
        }
        
        // Try flat structure: { artisans: [...] }
        if (rawArtisans.length === 0 && Array.isArray((response.data as any).artisans)) {
          rawArtisans = (response.data as any).artisans;
          console.log('✅ Extracted from response.data.artisans, count:', rawArtisans.length);
        }
      }

      console.log('Raw artisans extracted:', rawArtisans.length);
      if (rawArtisans.length > 0) {
        console.log('First raw artisan:', JSON.stringify(rawArtisans[0], null, 2));
      }

      // Filter out null/invalid artisans and normalize data
      const validArtisans = rawArtisans
        .filter((a: any) => a !== null && a !== undefined && typeof a === 'object')
        .map((a: any) => ({
          ...a,
          // Ensure id exists
          id: a.id || a._id || `artisan-${Math.random().toString(36).substr(2, 9)}`,
          // Normalize name fields
          fullName: a.fullName || a.name || 'Unknown Artisan',
          // Normalize rate
          rate: a.rate || { amount: a.hourlyRate || 0, period: a.ratePeriod || 'job' },
          // Normalize rating
          averageRating: a.averageRating || a.rating || 0,
          totalReviews: a.totalReviews || a.reviewCount || 0,
        }));

      console.log('Valid artisans after transform:', validArtisans.length);
      if (validArtisans.length > 0) {
        console.log('First valid artisan:', JSON.stringify(validArtisans[0], null, 2));
      }

      setArtisans(validArtisans);
      
      // FIXED: Better pagination extraction
      const responsePagination = response.data?.data?.pagination || response.data?.pagination;
      setPagination(responsePagination || { 
        page: 1, 
        limit: 12, 
        total: validArtisans.length, 
        pages: Math.max(1, Math.ceil(validArtisans.length / 12)) 
      });
    } catch (error: any) {
      console.error('Error fetching artisans:', error);
      toast.error('Failed to load artisans. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchArtisans();
  }, [fetchArtisans]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
    
    // Update URL params
    const newParams = new URLSearchParams(searchParams);
    if (value && value !== 'all' && value !== 'All States' && value !== 'All Skills') {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setFilters({
      q: '',
      state: 'All States',
      skills: 'All Skills',
      availability: 'all',
      minRating: 'all',
      maxRate: 'all',
      experienceYears: 'all',
      sortBy: 'rating',
    });
    setSearchParams({});
  };

  const hasActiveFilters = Object.entries(filters).some(([key, v]) => {
    if (key === 'sortBy') return false;
    return v !== '' && v !== 'all' && v !== 'All States' && v !== 'All Skills' && v !== 'rating';
  });

  // Client-side filtering for search query
  const filteredArtisans = useMemo(() => {
    if (!filters.q) return artisans;
    
    const query = filters.q.toLowerCase();
    return artisans.filter((artisan) => {
      const matchesName = artisan.fullName?.toLowerCase().includes(query);
      const matchesProfession = artisan.profession?.toLowerCase().includes(query);
      const matchesSkill = artisan.skills?.some((s: string) => s.toLowerCase().includes(query));
      const matchesLocation = `${artisan.location?.city || ''} ${artisan.location?.state || ''}`
        .toLowerCase()
        .includes(query);
      
      return matchesName || matchesProfession || matchesSkill || matchesLocation;
    });
  }, [artisans, filters.q]);

  // Get display name safely
  const getDisplayName = (artisan: SafeArtisan) => {
    if (typeof artisan.userId === 'object' && artisan.userId?.fullName) {
      return artisan.userId.fullName;
    }
    return artisan.fullName || artisan.name || 'Unknown Artisan';
  };

  // Get initials for avatar
  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'A';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Find Artisans</h1>
                <p className="text-gray-500 mt-1">
                  {filteredArtisans.length} artisan{filteredArtisans.length !== 1 ? 's' : ''} available
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className={`gap-2 ${showFilters ? 'bg-gray-100' : ''}`}
              >
                <Filter className="w-4 h-4" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1 w-5 h-5 bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center">
                    !
                  </span>
                )}
              </Button>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-2xl">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name, profession, skill, or location..."
                className="pl-10 pr-10 py-6 text-base"
                value={filters.q}
                onChange={(e) => handleFilterChange('q', e.target.value)}
              />
              {filters.q && (
                <button
                  onClick={() => handleFilterChange('q', '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-gray-500">Active filters:</span>
                {filters.q && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-gray-200">
                    Search: "{filters.q}"
                    <X className="w-3 h-3" onClick={() => handleFilterChange('q', '')} />
                  </Badge>
                )}
                {filters.state !== 'All States' && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-gray-200">
                    <MapPin className="w-3 h-3" />
                    {filters.state}
                    <X className="w-3 h-3" onClick={() => handleFilterChange('state', 'All States')} />
                  </Badge>
                )}
                {filters.skills !== 'All Skills' && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-gray-200">
                    {filters.skills}
                    <X className="w-3 h-3" onClick={() => handleFilterChange('skills', 'All Skills')} />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* Expandable Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">State</label>
                <Select value={filters.state} onValueChange={(v) => handleFilterChange('state', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    {NIGERIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Skill</label>
                <Select value={filters.skills} onValueChange={(v) => handleFilterChange('skills', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Skills" />
                  </SelectTrigger>
                  <SelectContent>
                    {SKILL_CATEGORIES.map((skill) => (
                      <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Min Rating</label>
                <Select value={filters.minRating} onValueChange={(v) => handleFilterChange('minRating', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Rating</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Max Rate</label>
                <Select value={filters.maxRate} onValueChange={(v) => handleFilterChange('maxRate', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Rate</SelectItem>
                    <SelectItem value="5000">₦5,000 or less</SelectItem>
                    <SelectItem value="10000">₦10,000 or less</SelectItem>
                    <SelectItem value="20000">₦20,000 or less</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />
            <p className="text-gray-500">Loading artisans...</p>
          </div>
        ) : filteredArtisans.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No artisans found</h3>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              {hasActiveFilters 
                ? "Try adjusting your search or filters to find what you're looking for."
                : "No artisans are available at the moment. Please check back later."}
            </p>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline" className="gap-2">
                <X className="w-4 h-4" />
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredArtisans.map((artisan) => (
                <ArtisanCard 
                  key={artisan.id || `artisan-${Math.random().toString(36).substr(2, 9)}`} 
                  artisan={artisan}
                  getDisplayName={getDisplayName}
                  getInitials={getInitials}
                />
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="mt-12 flex justify-center gap-2">
                <Button
                  variant="outline"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm text-gray-600">
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ==========================================
// ARTISAN CARD COMPONENT (Inline for safety)
// ==========================================
const ArtisanCard = ({ 
  artisan, 
  getDisplayName, 
  getInitials 
}: { 
  artisan: SafeArtisan; 
  getDisplayName: (a: SafeArtisan) => string;
  getInitials: (name: string) => string;
}) => {
  const displayName = getDisplayName(artisan);
  const initials = getInitials(displayName);
  const location = artisan.location;
  const rate = artisan.rate;
  const rating = artisan.averageRating || 0;
  const reviews = artisan.totalReviews || 0;
  const jobs = artisan.completedJobs || 0;
  const skills = artisan.skills || [];
  const isAvailable = artisan.availabilityStatus === 'available' || artisan.isAvailable;

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-gray-200 overflow-hidden bg-white">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-5">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-700 text-xl font-bold border-2 border-emerald-200">
              {artisan.profileImage ? (
                <img src={artisan.profileImage} alt={displayName} className="w-full h-full rounded-full object-cover" />
              ) : (
                initials
              )}
            </div>
            
            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg text-gray-900 truncate">
                  {displayName}
                </h3>
                {artisan.isCertified && (
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 text-xs border-0">
                    Certified
                  </Badge>
                )}
                {isAvailable && (
                  <Badge variant="secondary" className="bg-green-100 text-green-700 text-xs border-0">
                    Available
                  </Badge>
                )}
              </div>
              
              <p className="text-emerald-600 font-medium text-sm mt-0.5 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" />
                {artisan.profession || 'General Artisan'}
              </p>
              
              {/* Rating */}
              <div className="flex items-center gap-1.5 mt-2">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-sm font-semibold text-gray-800">
                  {rating.toFixed(1)}
                </span>
                <span className="text-sm text-gray-400">
                  ({reviews} reviews)
                </span>
                <span className="text-gray-300 mx-1">•</span>
                <span className="text-sm text-gray-500">
                  {jobs} jobs
                </span>
              </div>
            </div>
          </div>

          {/* Location */}
          {(location?.city || location?.state) && (
            <div className="flex items-center gap-1.5 mt-3 text-gray-500 text-sm">
              <MapPin className="w-4 h-4" />
              <span>
                {[location.city, location.state].filter(Boolean).join(', ')}
              </span>
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {skills.slice(0, 4).map((skill, idx) => (
                <Badge key={idx} variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                  {skill}
                </Badge>
              ))}
              {skills.length > 4 && (
                <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">
                  +{skills.length - 4}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 p-4 flex items-center justify-between bg-gray-50/50">
          <div className="text-sm">
            <span className="text-gray-500">From </span>
            <span className="font-bold text-gray-900">
              ₦{(rate?.amount || 0).toLocaleString()}
            </span>
            <span className="text-gray-500">/{rate?.period || 'job'}</span>
          </div>
          
          <a href={`/artisans/${artisan.id}`}>
            <Button 
              size="sm" 
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              View Profile
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
};

export default ArtisansPage;