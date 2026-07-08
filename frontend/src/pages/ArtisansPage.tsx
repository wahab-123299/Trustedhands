import { useEffect, useState, useCallback, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Search, MapPin, Filter, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import ArtisanCard from '@/components/artisans/ArtisanCard';

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
  isVerified?: boolean;
  availabilityStatus?: string;
  isAvailable?: boolean;
  userId?: string | { _id?: string; fullName?: string };
  hourlyRate?: number;
  ratePeriod?: string;
  rating?: number;
  reviewCount?: number;
  createdAt?: string;
}

const ArtisansPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
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

      let rawArtisans: any[] = [];

      if (response.data && typeof response.data === 'object') {
        if (response.data.data && typeof response.data.data === 'object') {
          if (Array.isArray(response.data.data.artisans)) {
            rawArtisans = response.data.data.artisans;
          } else if (Array.isArray(response.data.data)) {
            rawArtisans = response.data.data;
          }
        }
        if (rawArtisans.length === 0 && Array.isArray((response.data as any).artisans)) {
          rawArtisans = (response.data as any).artisans;
        }
      }

      const validArtisans = rawArtisans
        .filter((a: any) => a !== null && a !== undefined && typeof a === 'object')
        .map((a: any) => ({
          ...a,
          id: a.id || a._id || `artisan-${Math.random().toString(36).substr(2, 9)}`,
          fullName: a.fullName || a.name || 'Unknown Artisan',
          rate: a.rate || { amount: a.hourlyRate || 0, period: a.ratePeriod || 'job' },
          averageRating: a.averageRating || a.rating || 0,
          totalReviews: a.totalReviews || a.reviewCount || 0,
        }));

      setArtisans(validArtisans);

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

  const handleViewProfile = (artisanId: string) => {
    navigate(`/artisans/${artisanId}`);
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0f0a' }}>
      {/* Header Section */}
      <div style={{ 
        background: 'linear-gradient(180deg, #111827 0%, #0a0f0a 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.06)' 
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Find Artisans</h1>
                <p className="mt-1" style={{ color: '#6b7280' }}>
                  {filteredArtisans.length} artisan{filteredArtisans.length !== 1 ? 's' : ''} available
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-2"
                style={{ 
                  background: 'transparent', 
                  borderColor: 'rgba(255,255,255,0.1)', 
                  color: '#9ca3af' 
                }}
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
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: '#6b7280' }} />
              <Input
                type="text"
                placeholder="Search by name, profession, skill, or location..."
                className="pl-10 pr-10 py-6 text-base"
                style={{ 
                  background: '#111827', 
                  borderColor: 'rgba(255,255,255,0.08)', 
                  color: '#ffffff' 
                }}
                value={filters.q}
                onChange={(e) => handleFilterChange('q', e.target.value)}
              />
              {filters.q && (
                <button
                  onClick={() => handleFilterChange('q', '')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 hover:text-gray-300"
                  style={{ color: '#6b7280' }}
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Active Filters */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm" style={{ color: '#6b7280' }}>Active filters:</span>
                {filters.q && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-gray-700" style={{ background: '#1f2937', color: '#9ca3af' }}>
                    Search: "{filters.q}"
                    <X className="w-3 h-3" onClick={() => handleFilterChange('q', '')} />
                  </Badge>
                )}
                {filters.state !== 'All States' && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-gray-700" style={{ background: '#1f2937', color: '#9ca3af' }}>
                    <MapPin className="w-3 h-3" />
                    {filters.state}
                    <X className="w-3 h-3" onClick={() => handleFilterChange('state', 'All States')} />
                  </Badge>
                )}
                {filters.skills !== 'All Skills' && (
                  <Badge variant="secondary" className="gap-1 cursor-pointer hover:bg-gray-700" style={{ background: '#1f2937', color: '#9ca3af' }}>
                    {filters.skills}
                    <X className="w-3 h-3" onClick={() => handleFilterChange('skills', 'All Skills')} />
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-emerald-500 hover:text-emerald-400"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* Expandable Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#9ca3af' }}>State</label>
                <Select value={filters.state} onValueChange={(v) => handleFilterChange('state', v)}>
                  <SelectTrigger style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)', color: '#ffffff' }}>
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}>
                    {NIGERIAN_STATES.map((state) => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#9ca3af' }}>Skill</label>
                <Select value={filters.skills} onValueChange={(v) => handleFilterChange('skills', v)}>
                  <SelectTrigger style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)', color: '#ffffff' }}>
                    <SelectValue placeholder="All Skills" />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}>
                    {SKILL_CATEGORIES.map((skill) => (
                      <SelectItem key={skill} value={skill}>{skill}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#9ca3af' }}>Min Rating</label>
                <Select value={filters.minRating} onValueChange={(v) => handleFilterChange('minRating', v)}>
                  <SelectTrigger style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)', color: '#ffffff' }}>
                    <SelectValue placeholder="Any Rating" />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}>
                    <SelectItem value="all">Any Rating</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block" style={{ color: '#9ca3af' }}>Max Rate</label>
                <Select value={filters.maxRate} onValueChange={(v) => handleFilterChange('maxRate', v)}>
                  <SelectTrigger style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)', color: '#ffffff' }}>
                    <SelectValue placeholder="Any Rate" />
                  </SelectTrigger>
                  <SelectContent style={{ background: '#111827', borderColor: 'rgba(255,255,255,0.08)' }}>
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
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500 mb-4" />
            <p style={{ color: '#6b7280' }}>Loading artisans...</p>
          </div>
        ) : filteredArtisans.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#1f2937' }}>
              <Search className="w-10 h-10" style={{ color: '#4b5563' }} />
            </div>
            <h3 className="text-xl font-semibold mb-2" style={{ color: '#ffffff' }}>No artisans found</h3>
            <p className="max-w-md mx-auto mb-6" style={{ color: '#6b7280' }}>
              {hasActiveFilters 
                ? "Try adjusting your search or filters to find what you're looking for."
                : "No artisans are available at the moment. Please check back later."}
            </p>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline" className="gap-2" style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}>
                <X className="w-4 h-4" />
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredArtisans.map((artisan) => (
                <ArtisanCard 
                  key={artisan.id} 
                  artisan={artisan}
                  onViewProfile={handleViewProfile}
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
                  style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm" style={{ color: '#6b7280' }}>
                  Page {pagination.page} of {pagination.pages}
                </span>
                <Button
                  variant="outline"
                  disabled={pagination.page === pagination.pages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#9ca3af' }}
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

export default ArtisansPage;