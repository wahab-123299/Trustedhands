import { useEffect, useState } from 'react';
import { adminApi } from '@/services/api';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';

/**
 * @typedef {Object} User
 * @property {string} _id
 * @property {string} [fullName]
 * @property {string} [email]
 */

/**
 * @typedef {Object} IdVerification
 * @property {string} [submittedAt]
 * @property {string} [idType]
 */

/**
 * @typedef {Object} Rate
 * @property {number} [amount]
 * @property {string} [period]
 */

/**
 * @typedef {Object} VerificationProfile
 * @property {string} _id
 * @property {User} [userId]
 * @property {string} [profession]
 * @property {number} [experienceYears]
 * @property {Rate} [rate]
 * @property {IdVerification} [idVerification]
 * @property {string} [bio]
 */

const AdminVerifications = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    loadVerifications();
  }, [page]);

  const loadVerifications = async () => {
    try {
      setLoading(true);
      const response = await adminApi.getPendingVerifications({ page });
      setProfiles(response.data.data.profiles);
      setTotalPages(response.data.data.pagination.pages);
    } catch (error) {
      toast.error('Failed to load verifications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (profileId) => {
    try {
      await adminApi.verifyArtisan(profileId, 'approve');
      toast.success('Artisan verified successfully');
      loadVerifications();
      setShowModal(false);
    } catch (error) {
      toast.error('Failed to verify artisan');
    }
  };

  const handleReject = async (profileId) => {
    try {
      await adminApi.verifyArtisan(profileId, 'reject', rejectionReason);
      toast.success('Verification rejected');
      loadVerifications();
      setShowModal(false);
      setShowRejectForm(false);
      setRejectionReason('');
    } catch (error) {
      toast.error('Failed to reject verification');
    }
  };

  const viewDetails = (profile) => {
    setSelectedProfile(profile);
    setShowModal(true);
    setShowRejectForm(false);
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
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Pending Verifications</h2>
        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm font-medium">
          {profiles.length} pending
        </span>
      </div>

      {profiles.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">All caught up!</h3>
          <p className="text-gray-500">No pending artisan verifications.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Artisan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profession</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {profiles.map((profile) => (
                  <tr key={profile._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-sm font-medium text-gray-600">
                            {profile.userId?.fullName?.[0] || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{profile.userId?.fullName}</p>
                          <p className="text-sm text-gray-500">{profile.userId?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">{profile.profession}</td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {profile.idVerification?.submittedAt
                        ? new Date(profile.idVerification.submittedAt).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => viewDetails(profile)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => handleApprove(profile._id)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button
                          onClick={() => viewDetails(profile)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {showModal && selectedProfile && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-auto p-6">
            <h3 className="text-lg font-semibold mb-4">Verification Details</h3>

            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xl font-medium">{selectedProfile.userId?.fullName?.[0]}</span>
                </div>
                <div>
                  <h4 className="text-lg font-semibold">{selectedProfile.userId?.fullName}</h4>
                  <p className="text-gray-500">{selectedProfile.userId?.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Profession</p>
                  <p className="font-medium">{selectedProfile.profession}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Experience</p>
                  <p className="font-medium">{selectedProfile.experienceYears} years</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">Rate</p>
                  <p className="font-medium">
                    ₦{selectedProfile.rate?.amount?.toLocaleString()} / {selectedProfile.rate?.period}
                  </p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500">ID Type</p>
                  <p className="font-medium capitalize">{selectedProfile.idVerification?.idType || 'Not specified'}</p>
                </div>
              </div>

              {selectedProfile.bio && (
                <div>
                  <h5 className="font-semibold mb-2">Bio</h5>
                  <p className="text-gray-700 bg-gray-50 p-4 rounded-lg">{selectedProfile.bio}</p>
                </div>
              )}

              {showRejectForm && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rejection Reason
                  </label>
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Why is this verification being rejected?"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => handleApprove(selectedProfile._id)}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                >
                  Approve
                </button>
                {!showRejectForm ? (
                  <button
                    onClick={() => setShowRejectForm(true)}
                    className="flex-1 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                  >
                    Reject
                  </button>
                ) : (
                  <button
                    onClick={() => handleReject(selectedProfile._id)}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Confirm Rejection
                  </button>
                )}
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVerifications;