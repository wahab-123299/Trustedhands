import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion} from 'framer-motion';
import { Search, MapPin, Shield, Star, Users, CheckCircle, ArrowRight, Briefcase } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { jobApi, artisanApi } from '@/services/api';
import { Job, ArtisanProfile, NIGERIAN_STATES, SKILL_CATEGORIES } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const HomePage = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const [featuredArtisans, setFeaturedArtisans] = useState<ArtisanProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFeaturedData();
  }, []);

  const fetchFeaturedData = async () => {
    try {
      setIsLoading(true);
      const [jobsRes, artisansRes] = await Promise.all([
        jobApi.getAll({ limit: 6 }),  // Change from getAllJobs to getAll
        artisanApi.getAll({ limit: 4, sortBy: 'rating' }),  // Change from getArtisans to getAll
      ]);

      setFeaturedJobs(jobsRes.data.data.jobs);
      setFeaturedArtisans(artisansRes.data.data.artisans);
    } catch (error) {
      console.error('Error fetching featured data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.append('q', searchQuery);
    if (selectedLocation) params.append('state', selectedLocation);
    navigate(`/artisans?${params.toString()}`);
  };

  const stats = [
    { value: '10,000+', label: 'Verified Artisans', icon: Users },
    { value: '50,000+', label: 'Happy Customers', icon: CheckCircle },
    { value: '36', label: 'States Covered', icon: MapPin },
    { value: '4.8/5', label: 'Average Rating', icon: Star },
  ];

  const features = [
    {
      title: 'Verified Artisans',
      description: 'All artisans are thoroughly vetted and verified for your peace of mind.',
      icon: Shield,
    },
    {
      title: 'Secure Payments',
      description: 'Your payments are held securely until the job is completed to your satisfaction.',
      icon: CheckCircle,
    },
    {
      title: 'Rated & Reviewed',
      description: 'Read genuine reviews from other customers before making your choice.',
      icon: Star,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-emerald-50 to-white py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-4 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                #1 Artisan Marketplace in Nigeria
              </Badge>
              <h1 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Find Skilled <span className="text-emerald-600">Artisans</span> for Your Home, Organisation or Business Needs
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Connect with trusted skilled workers for your home repairs, renovations, 
                and maintenance needs. Verified professionals, secure payments, guaranteed satisfaction.
              </p>

              {/* Search Box */}
              <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-100">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="What service do you need?"
                      className="pl-10 h-12"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="sm:w-48">
                    <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                      <SelectTrigger className="h-12">
                        <MapPin className="w-5 h-5 text-gray-400 mr-2" />
                        <SelectValue placeholder="Select Location" />
                      </SelectTrigger>
                      <SelectContent>
                        {NIGERIAN_STATES.map((state) => (
                          <SelectItem key={state.name} value={state.name}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="h-12 px-8 bg-emerald-500 hover:bg-emerald-600"
                    onClick={handleSearch}
                  >
                    Search
                  </Button>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center gap-6 mt-8">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                  Verified Artisans
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Shield className="w-5 h-5 text-emerald-500" />
                  Secure Payments
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Star className="w-5 h-5 text-emerald-500" />
                  Rated & Reviewed
                </div>
              </div>
            </div>

            {/* Hero Image */}
            <div className="hidden lg:block">
              <img
                src="https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600&h=500&fit=crop"
                alt="Professional artisan at work"
                className="rounded-2xl shadow-2xl w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-emerald-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center text-white">
                <stat.icon className="w-8 h-8 mx-auto mb-3 opacity-80" />
                <div className="text-3xl lg:text-4xl font-bold mb-1">{stat.value}</div>
                <div className="text-emerald-100">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Recent Jobs Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Recent Jobs Posted</h2>
              <p className="text-gray-600 mt-1">Find work opportunities in your area</p>
            </div>
            <Link to="/jobs">
              <Button variant="outline" className="hidden sm:flex items-center gap-2">
                View All Jobs
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
    
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredJobs.map((job) => (
                 <Card key={job._id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <Badge variant="secondary">{job.category}</Badge>
                      <span className="text-sm text-gray-500">{formatDate(job.createdAt)}</span>
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{job.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-2">{job.description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      <MapPin className="w-4 h-4" />
                      {job.location.city}, {job.location.state}
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-emerald-600">
                        {formatCurrency(job.budget)}
                        <span className="text-sm font-normal text-gray-500 ml-1">{job.budgetType}</span>
                      </div>
                      <Link to={`/jobs/${job._id}`}>
                        <Button variant="outline" size="sm">View Details</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredJobs.map((job) => (
              <Card key={job._id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <Badge variant="secondary">{job.category}</Badge>
                    <span className="text-sm text-gray-500">{formatDate(job.createdAt)}</span>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{job.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{job.description}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <MapPin className="w-4 h-4" />
                    {job.location.city}, {job.location.state}
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="font-bold text-emerald-600">
                      {formatCurrency(job.budget)}
                      <span className="text-sm font-normal text-gray-500 ml-1">{job.budgetType}</span>
                    </div>
                    <Link to={`/jobs/${job._id}`}>
                      <Button variant="outline" size="sm">View Details</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 text-center sm:hidden">
            <Link to="/jobs">
              <Button variant="outline">View All Jobs</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Popular Services Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Popular Services</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Find skilled professionals across various categories
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {SKILL_CATEGORIES.slice(0, 12).map((skill) => (
              <Link
                key={skill}
                to={`/artisans?skills=${skill}`}
                className="p-4 bg-white border border-gray-200 rounded-lg text-center hover:border-emerald-500 hover:shadow-md transition-all"
              >
                <Briefcase className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <span className="text-sm font-medium text-gray-700">{skill}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Artisans Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h2 className="text-2xl lg:text-3xl font-bold text-gray-900">Top Rated Artisans</h2>
              <p className="text-gray-600 mt-1">Highly skilled professionals in your area</p>
            </div>
            <Link to="/artisans">
              <Button variant="outline" className="hidden sm:flex items-center gap-2">
                View All Artisans
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredArtisans.map((artisan) => (
                <Card key={artisan._id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                        <span className="text-emerald-700 font-bold">
                          {artisan.user?.fullName?.charAt(0) || 'A'}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-semibold">{artisan.user?.fullName || 'Artisan'}</h3>
                        <div className="flex items-center gap-1 text-sm text-amber-500">
                          <Star className="w-4 h-4 fill-current" />
                          <span>{artisan.rating?.toFixed(1) || '0.0'}</span>
                          <span className="text-gray-400">({artisan.reviewCount || 0})</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {artisan.skills?.slice(0, 3).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-xs">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                      <MapPin className="w-4 h-4" />
                      {artisan.user?.location?.city || 'Unknown location'}
                    </div>
                    <Link to={`/artisans/${artisan._id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        View Profile
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="mt-6 text-center sm:hidden">
            <Link to="/artisans">
              <Button variant="outline">View All Artisans</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4">Why Choose TrustedHand?</h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              We make it easy to find and hire skilled artisans you can trust
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
                <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-emerald-600" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-emerald-600 rounded-2xl p-8 lg:p-12 text-center text-white">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-emerald-100 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of satisfied customers who have found skilled artisans through TrustedHand.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="bg-white text-emerald-600 hover:bg-gray-100">
                  Sign Up Now
                </Button>
              </Link>
              <Link to="/artisans">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-emerald-700">
                  Browse Artisans
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
