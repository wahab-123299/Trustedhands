import { useEffect, useState } from 'react';
import { artisanApi } from '@/services/api';
import { Briefcase, Star, MapPin, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

const AdminArtisans = () => {
  const [artisans, setArtisans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArtisans();
  }, []);

  const loadArtisans = async () => {
    try {
      setLoading(true);
      const response = await artisanApi.getAll({ limit: 100 });
      setArtisans(response.data.data?.artisans || []);
    } catch (error) {
      toast.error('Failed to load artisans');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Artisans Management</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {artisans.length === 0 ? (
          <div className="col-span-full text-center py-8 text-gray-500">
            No artisans found
          </div>
        ) : (
          artisans.map((artisan) => (
            <div key={artisan._id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-lg font-medium text-emerald-700">
                    {artisan.fullName?.[0] || 'A'}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{artisan.fullName}</h3>
                  <p className="text-sm text-gray-500">{artisan.profession}</p>
                </div>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin size={16} />
                  {artisan.location?.city}, {artisan.location?.state}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Star size={16} className="text-yellow-500" />
                  {artisan.averageRating || 0} ({artisan.totalReviews || 0} reviews)
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Briefcase size={16} />
                  {artisan.completedJobs || 0} jobs completed
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-1 text-xs ${
                  artisan.isVerified ? 'text-green-600' : 'text-gray-400'
                }`}>
                  <CheckCircle size={14} />
                  {artisan.isVerified ? 'Verified' : 'Unverified'}
                </span>
                <button className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                  View Profile
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AdminArtisans;