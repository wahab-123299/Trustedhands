import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { jobApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

// ==============================
// TYPES
// ==============================

interface Job {
  _id: string;
  title: string;
  description: string;
  budget: number;
  location: {
    state: string;
    city: string;
    address?: string;
  };
  status: "pending" | "accepted" | "in_progress" | "completed" | "cancelled" | "open";
  createdAt: string;
  customerId: string | {
    _id: string;
    fullName: string;
    profileImage?: string;
    phone?: string;
  };
  artisanId?: string | {
    _id: string;
    fullName: string;
    profileImage?: string;
  };
  applications?: any[];
}

// ==============================
// HELPER FUNCTIONS
// ==============================

// Helper to safely get ID from populated or unpopulated field
const getId = (field: string | { _id: string } | undefined | null): string | undefined => {
  if (!field) return undefined;
  if (typeof field === 'string') return field;
  return field._id;
};

// Helper to safely get name from populated field
const getName = (field: { fullName?: string } | undefined | null): string => {
  return field?.fullName || 'Unknown';
};

// Helper to check if field is populated object
const isPopulated = (field: any): field is { _id: string; fullName: string } => {
  return field && typeof field === 'object' && '_id' in field;
};

// ==============================
// COMPONENT
// ==============================

const JobDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // ==============================
  // FETCH JOB
  // ==============================

  const fetchJob = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      const response = await jobApi.getById(id);
      setJob(response.data.data.job);
    } catch (error: any) {
      toast.error("Failed to load job");
      navigate("/jobs");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (id) fetchJob();
  }, [id, fetchJob]);

  // ==============================
  // APPLY / ACCEPT JOB
  // ==============================

  const handleApply = async () => {
    if (!id) return;

    try {
      setActionLoading(true);
      await jobApi.apply(id);
      toast.success("Application sent!");
      fetchJob();
    } catch (error: any) {
      toast.error(error?.message || "Failed to apply");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!id) return;

    try {
      setActionLoading(true);
      await jobApi.accept(id);
      toast.success("Job accepted!");
      fetchJob();
    } catch (error: any) {
      toast.error(error?.message || "Failed to accept job");
    } finally {
      setActionLoading(false);
    }
  };

  // ==============================
  // CHAT
  // ==============================

  const goToChat = () => {
    if (!job) return;

    const customerId = getId(job.customerId);
    const artisanId = getId(job.artisanId);

    let otherUserId: string | undefined;
    
    if (user?._id === customerId) {
      // I'm the customer, chat with artisan
      otherUserId = artisanId;
    } else {
      // I'm the artisan, chat with customer
      otherUserId = customerId;
    }

    if (!otherUserId) {
      toast.error("No user to chat with yet");
      return;
    }

    navigate(`/chat/${otherUserId}`);
  };

  // ==============================
  // UI STATES
  // ==============================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Job not found</p>
          <button
            onClick={() => navigate("/jobs")}
            className="text-green-600 hover:underline"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  // ==============================
  // DERIVED VALUES
  // ==============================

  const customerId = getId(job.customerId);
  const artisanId = getId(job.artisanId);
  
  const isOwner = user?._id === customerId;
  const isArtisan = user?.role === "artisan";
  const isAssigned = !!artisanId;
  const isPending = job.status === "pending" || job.status === "open";
  const isAccepted = job.status === "accepted" || job.status === "in_progress";

  // Get display names
  const customerName = isPopulated(job.customerId) 
    ? job.customerId.fullName 
    : 'Customer';
  
  const artisanName = isPopulated(job.artisanId) 
    ? job.artisanId.fullName 
    : (isAssigned ? 'Artisan assigned' : 'Not assigned');

  // ==============================
  // UI
  // ==============================

  return (
    <div className="max-w-3xl mx-auto p-6">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
      >
        ← Back
      </button>

      <div className="bg-white shadow-lg rounded-2xl p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{job.title}</h1>
          <p className="text-gray-600 mt-2">{job.description}</p>
        </div>

        {/* Job Meta */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-600">
            <span>📍</span>
            <span>{job.location?.city || 'Unknown city'}, {job.location?.state || 'Unknown state'}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span>💰</span>
            <span>₦{job.budget?.toLocaleString() || job.budget}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-600">
            <span>📅</span>
            <span>{new Date(job.createdAt).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Status:</span>
            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
              job.status === 'completed' ? 'bg-green-100 text-green-800' :
              job.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
              job.status === 'cancelled' ? 'bg-red-100 text-red-800' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {job.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* People Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Customer</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                {customerName.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-900">{customerName}</p>
                {isPopulated(job.customerId) && job.customerId.phone && (
                  <p className="text-sm text-gray-500">{job.customerId.phone}</p>
                )}
              </div>
            </div>
          </div>

          {/* Artisan */}
          <div className={`rounded-lg p-4 ${isAssigned ? 'bg-green-50' : 'bg-gray-50'}`}>
            <h3 className="font-semibold text-gray-900 mb-2">Assigned Artisan</h3>
            {isAssigned ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
                  {artisanName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{artisanName}</p>
                  <p className="text-sm text-green-600">✓ Assigned</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                  ?
                </div>
                <div>
                  <p className="font-medium text-gray-500">Not assigned yet</p>
                  <p className="text-sm text-gray-400">Waiting for applications</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Applications Section (for owner) */}
        {isOwner && job.applications && job.applications.length > 0 && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-3">
              Applications ({job.applications.length})
            </h3>
            <div className="space-y-2">
              {job.applications.map((app: any, idx: number) => (
                <div key={idx} className="bg-white rounded p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{app.artisanId?.fullName || 'Artisan'}</p>
                    <p className="text-sm text-gray-500">{app.status}</p>
                  </div>
                  {app.status === 'pending' && (
                    <button
                      onClick={() => {/* handle accept application */}}
                      className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                    >
                      Accept
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 flex-wrap">
          {/* Artisan can apply */}
          {!isOwner && isArtisan && isPending && !isAssigned && (
            <button
              onClick={handleApply}
              disabled={actionLoading}
              className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? 'Applying...' : 'Apply for Job'}
            </button>
          )}

          {/* Customer accepts artisan */}
          {isOwner && isAssigned && isPending && (
            <button
              onClick={handleAccept}
              disabled={actionLoading}
              className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? 'Accepting...' : 'Accept Artisan'}
            </button>
          )}

          {/* Start Job (for artisan when accepted) */}
          {isArtisan && !isOwner && isAssigned && isAccepted && job.artisanId && getId(job.artisanId) === user?._id && (
            <button
              onClick={() => {/* handle start */}}
              className="flex-1 bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Start Job
            </button>
          )}

          {/* Complete Job */}
          {isAssigned && isAccepted && (
            <button
              onClick={() => {/* handle complete */}}
              className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Mark Complete
            </button>
          )}

          {/* Chat */}
          {isAssigned && (
            <button
              onClick={goToChat}
              className="bg-gray-800 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-900 transition-colors"
            >
              💬 Chat
            </button>
          )}

          {/* Cancel Job (for owner when pending) */}
          {isOwner && isPending && (
            <button
              onClick={() => {/* handle cancel */}}
              className="border border-red-300 text-red-600 px-6 py-3 rounded-lg font-medium hover:bg-red-50 transition-colors"
            >
              Cancel Job
            </button>
          )}
        </div>

        {/* Info Messages */}
        {!isAssigned && isPending && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
            <p className="font-medium">⏳ Waiting for artisans to apply...</p>
            <p className="mt-1">You'll be notified when someone applies for this job.</p>
          </div>
        )}

        {isAssigned && isPending && isOwner && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium">✓ An artisan has been assigned!</p>
            <p className="mt-1">Click "Accept Artisan" to start the job.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default JobDetailsPage;