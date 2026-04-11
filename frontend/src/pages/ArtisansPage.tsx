import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, MapPin, Star, Filter, X } from 'lucide-react';
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
import { ArtisanProfile, NIGERIAN_STATES, SKILL_CATEGORIES } from '@/types';
import { formatCurrency } from '@/lib/utils';
import ArtisanCard from '@/components/artisans/ArtisanCard';

const ArtisansPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [artisans, setArtisans] = useState<ArtisanProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0,
  });

  // Filter states - Changed defaults from '' to 'all'
  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    state: searchParams.get('state') || 'all',
    city: searchParams.get('city') || '',
    skills: searchParams.get('skills') || 'all',
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

      // Changed checks from '' to 'all'
      if (filters.state && filters.state !== 'all') params.state = filters.state;
      if (filters.skills && filters.skills !== 'all') params.skills = filters.skills;
      if (filters.availability && filters.availability !== 'all') params.availability = filters.availability;
      if (filters.minRating && filters.minRating !== 'all') params.minRating = filters.minRating;
      if (filters.maxRate && filters.maxRate !== 'all') params.maxRate = filters.maxRate;
      if (filters.experienceYears && filters.experienceYears !== 'all') params.experienceYears = filters.experienceYears;

      let response;
      if (filters.q) {
        // ✅ FIXED: Changed from searchArtisans to search
        response = await artisanApi.search(filters.q, params);
      } else {
        // ✅ FIXED: Changed from getArtisans to getAll
        response = await artisanApi.getAll(params);
      }

      setArtisans(response.data.data.artisans);
      setPagination(response.data.data.pagination);
    } catch (error) {
      console.error('Error fetching artisans:', error);
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
  };

  const clearFilters = () => {
    setFilters({
      q: '',
      state: 'all',
      city: '',
      skills: 'all',
      availability: 'all',
      minRating: 'all',
      maxRate: 'all',
      experienceYears: 'all',
      sortBy: 'rating',
    });
    setSearchParams({});
  };

  // Updated check for active filters
  const hasActiveFilters = Object.entries(filters).some(([key, v]) => {
    if (key === 'sortBy') return false;
    return v !== '' && v !== 'all' && v !== 'rating';
  });

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Find Artisans</h1>
          <p className="text-gray-600">Browse verified skilled workers in your area</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by name or skill..."
                className="pl-10"
                value={filters.q}
                onChange={(e) => handleFilterChange('q', e.target.value)}
              />
            </div>

            {/* Location Filter - FIXED empty value */}
            <div className="lg:w-48">
              <Select value={filters.state} onValueChange={(value) => handleFilterChange('state', value)}>
                <SelectTrigger>
                  <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {NIGERIAN_STATES.map((state) => (
                    <SelectItem key={state.name} value={state.name}>
                      {state.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Skills Filter - FIXED empty value */}
            <div className="lg:w-48">
              <Select value={filters.skills} onValueChange={(value) => handleFilterChange('skills', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Skills" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Skills</SelectItem>
                  {SKILL_CATEGORIES.map((skill) => (
                    <SelectItem key={skill} value={skill}>
                      {skill}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort */}
            <div className="lg:w-40">
              <Select value={filters.sortBy} onValueChange={(value) => handleFilterChange('sortBy', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rating">Top Rated</SelectItem>
                  <SelectItem value="price_low">Price: Low to High</SelectItem>
                  <SelectItem value="price_high">Price: High to Low</SelectItem>
                  <SelectItem value="experience">Experience</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? 'bg-gray-100' : ''}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
              {hasActiveFilters && (
                <span className="ml-2 w-5 h-5 bg-emerald-500 text-white text-xs rounded-full flex items-center justify-center">
                  !
                </span>
              )}
            </Button>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {/* Min Rating - FIXED empty value */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Min Rating</label>
                <Select value={filters.minRating} onValueChange={(value) => handleFilterChange('minRating', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Rating</SelectItem>
                    <SelectItem value="4">4+ Stars</SelectItem>
                    <SelectItem value="3">3+ Stars</SelectItem>
                    <SelectItem value="2">2+ Stars</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Max Rate - FIXED empty value */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Max Rate</label>
                <Select value={filters.maxRate} onValueChange={(value) => handleFilterChange('maxRate', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Rate" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Rate</SelectItem>
                    <SelectItem value="5000">₦5,000 or less</SelectItem>
                    <SelectItem value="10000">₦10,000 or less</SelectItem>
                    <SelectItem value="20000">₦20,000 or less</SelectItem>
                    <SelectItem value="50000">₦50,000 or less</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Experience - FIXED empty value */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Experience</label>
                <Select value={filters.experienceYears} onValueChange={(value) => handleFilterChange('experienceYears', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Experience</SelectItem>
                    <SelectItem value="0-1">0-1 years</SelectItem>
                    <SelectItem value="1-3">1-3 years</SelectItem>
                    <SelectItem value="3-5">3-5 years</SelectItem>
                    <SelectItem value="5-10">5-10 years</SelectItem>
                    <SelectItem value="10+">10+ years</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Availability - FIXED empty value */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Availability</label>
                <Select value={filters.availability} onValueChange={(value) => handleFilterChange('availability', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Status</SelectItem>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="busy">Busy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <div className="md:col-span-3 lg:col-span-4 flex justify-end">
                  <Button variant="ghost" onClick={clearFilters} className="text-red-500">
                    <X className="w-4 h-4 mr-2" />
                    Clear All Filters
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4 text-gray-600">
          Showing {artisans.length} of {pagination.total} artisans
        </div>

        {/* Artisans Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-4" />
                  <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 mx-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : artisans.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No artisans found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your filters or search query</p>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {artisans.map((artisan) => (
              <ArtisanCard key={artisan._id} artisan={artisan} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="mt-8 flex justify-center gap-2">
            <Button
              variant="outline"
              disabled={pagination.page === 1}
              onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <span className="flex items-center px-4">
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
      </div>
    </div>
  );
};

export default ArtisansPage;