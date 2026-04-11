import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, MapPin, Filter, X, Briefcase, Calendar } from 'lucide-react';
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
import { jobApi } from '@/services/api';
import { Job, NIGERIAN_STATES, SKILL_CATEGORIES } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

const JobsPage = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    total: 0,
    pages: 0,
  });

  // Filter states - use "all" instead of "" for empty values
  const [filters, setFilters] = useState({
    state: searchParams.get('state') || 'all',
    city: searchParams.get('city') || '',
    category: searchParams.get('category') || 'all',
    minBudget: searchParams.get('minBudget') || '',
    maxBudget: searchParams.get('maxBudget') || 'any',
  });

  const fetchJobs = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: any = {
        page: pagination.page,
        limit: pagination.limit,
      };

      // Only add filters if they're not "all"/"any"
      if (filters.state && filters.state !== 'all') params.state = filters.state;
      if (filters.category && filters.category !== 'all') params.category = filters.category;
      if (filters.minBudget) params.minBudget = filters.minBudget;
      if (filters.maxBudget && filters.maxBudget !== 'any') params.maxBudget = filters.maxBudget;

      const response = await jobApi.getAll(params);
      setJobs(response.data.data.jobs);
      setPagination(response.data.data.pagination);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({
      state: 'all',
      city: '',
      category: 'all',
      minBudget: '',
      maxBudget: 'any',
    });
    setSearchParams({});
  };

  // Check for active filters (excluding "all"/"any")
  const hasActiveFilters = 
    (filters.state && filters.state !== 'all') ||
    (filters.category && filters.category !== 'all') ||
    (filters.maxBudget && filters.maxBudget !== 'any') ||
    filters.city !== '' ||
    filters.minBudget !== '';

  const canApply = (job: Job) => {
    if (!user || user.role !== 'artisan') return false;
    return job.status === 'pending';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Available Jobs</h1>
          <p className="text-gray-600">Find work opportunities in your area</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Location Filter - FIXED: value="all" instead of "" */}
            <div className="lg:w-48">
              <Select 
                value={filters.state} 
                onValueChange={(value) => handleFilterChange('state', value)}
              >
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

            {/* Category Filter - FIXED: value="all" instead of "" */}
            <div className="lg:w-48">
              <Select 
                value={filters.category} 
                onValueChange={(value) => handleFilterChange('category', value)}
              >
                <SelectTrigger>
                  <Briefcase className="w-4 h-4 text-gray-400 mr-2" />
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {SKILL_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Budget Filter - FIXED: value="any" instead of "" */}
            <div className="lg:w-48">
              <Select 
                value={filters.maxBudget} 
                onValueChange={(value) => handleFilterChange('maxBudget', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Any Budget" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Budget</SelectItem>
                  <SelectItem value="10000">₦10,000 or less</SelectItem>
                  <SelectItem value="50000">₦50,000 or less</SelectItem>
                  <SelectItem value="100000">₦100,000 or less</SelectItem>
                  <SelectItem value="500000">₦500,000 or less</SelectItem>
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

            {hasActiveFilters && (
              <Button variant="ghost" onClick={clearFilters} className="text-red-500">
                <X className="w-4 h-4 mr-2" />
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-gray-600">
          Showing {jobs.length} of {pagination.total} jobs
        </div>

        {/* Jobs Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-4" />
                  <div className="h-3 bg-gray-200 rounded w-full mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Briefcase className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your filters</p>
            {hasActiveFilters && (
              <Button onClick={clearFilters} variant="outline">
                Clear Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jobs.map((job) => (
              <Card key={job._id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  {/* Header */}
                  <div className="flex justify-between items-start mb-3">
                    <Badge variant="secondary">{job.category}</Badge>
                    <span className="text-sm text-gray-500">{formatDate(job.createdAt)}</span>
                  </div>

                  {/* Title */}
                  <h3 className="font-semibold text-lg mb-2">{job.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{job.description}</p>

                  {/* Location */}
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                    <MapPin className="w-4 h-4" />
                    {job.location.city}, {job.location.state}
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Calendar className="w-4 h-4" />
                    {formatDate(job.scheduledDate)}
                  </div>

                  {/* Budget */}
                  <div className="flex justify-between items-center mb-4">
                    <div className="font-bold text-emerald-600">
                      {formatCurrency(job.budget)}
                      <span className="text-sm font-normal text-gray-500 ml-1">{job.budgetType}</span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {job.applications?.length || 0} applications
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link to={`/jobs/${job._id}`} className="flex-1">
                      <Button variant="outline" className="w-full">View Details</Button>
                    </Link>
                    {canApply(job) && (
                      <Button className="flex-1 bg-emerald-500 hover:bg-emerald-600">
                        Apply Now
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
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

export default JobsPage;