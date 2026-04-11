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
  location: string;
  status: "open" | "in-progress" | "completed";
  createdAt: string;
  customer: {
    _id: string;
    fullName: string;
  };
  artisan?: {
    _id: string;
    fullName: string;
  };
}

// ==============================
// COMPONENT
// ==============================

const JobDetails = () => {
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
  if (!id) {
    navigate("/jobs");
    return;
  }
  
  try {
    setLoading(true);
    const response = await jobApi.getById(id);
    setJob(response.data.data.job);  // ✅ Extract .job property
  } catch {
    toast.error("Failed to load job");
    navigate("/jobs");
  } finally {
    setLoading(false);
  }
}, [id, navigate]);

useEffect(() => {
  fetchJob();
}, [fetchJob]);

  // ==============================
  // APPLY TO JOB (ARTISAN)
  // ==============================

  const handleApply = async () => {
  try {
    setActionLoading(true);
    await jobApi.apply(id || '');  // ✅ Use 'apply' instead of 'applyToJob'
    toast.success("Application submitted");
  } catch (error: any) {
    toast.error(error?.message || "Failed to apply");
  } finally {
    setActionLoading(false);
  }
};

  // ==============================
  // NAVIGATION
  // ==============================

  const goToApplications = () => {
    navigate(`/jobs/${id}/applications`);
  };

  const goToChat = () => {
    if (!job) return;

    const otherUserId =
      user?._id === job.customer._id
        ? job.artisan?._id
        : job.customer._id;

    if (!otherUserId) {
      toast.error("No one to chat with yet");
      return;
    }

    navigate(`/chat/${otherUserId}`);
  };

  // ==============================
  // UI STATES
  // ==============================

  if (loading) {
    return <div className="p-6 text-center">Loading job...</div>;
  }

  if (!job) {
    return <div className="p-6 text-center">Job not found</div>;
  }

  // ==============================
  // CONDITIONS
  // ==============================

  const isOwner = user?._id === job.customer._id;
  const isArtisan = user?.role === "artisan";
  const isAssigned = !!job.artisan;

  // ==============================
  // UI
  // ==============================

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* BACK */}
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-sm text-gray-500"
      >
        ← Back
      </button>

      <div className="bg-white shadow rounded-2xl p-6 space-y-4">
        {/* TITLE */}
        <h1 className="text-2xl font-bold">{job.title}</h1>

        {/* DESCRIPTION */}
        <p className="text-gray-600">{job.description}</p>

        {/* DETAILS */}
        <div className="flex justify-between text-sm text-gray-500">
          <span>📍 {job.location}</span>
          <span>💰 ₦{job.budget}</span>
        </div>

        {/* STATUS */}
        <div>
          Status:{" "}
          <span className="capitalize font-medium">
            {job.status}
          </span>
        </div>

        <hr />

        {/* CUSTOMER */}
        <div>
          <strong>Customer:</strong> {job.customer.fullName}
        </div>

        {/* ARTISAN */}
        {job.artisan && (
          <div>
            <strong>Assigned Artisan:</strong>{" "}
            {job.artisan.fullName}
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex gap-3 pt-4 flex-wrap">
          {/* Artisan apply */}
          {!isOwner && isArtisan && job.status === "open" && (
            <button
              onClick={handleApply}
              disabled={actionLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Apply
            </button>
          )}

          {/* Customer view applications */}
          {isOwner && job.status === "open" && (
            <button
              onClick={goToApplications}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg"
            >
              View Applications
            </button>
          )}

          {/* Chat */}
          {isAssigned && (
            <button
              onClick={goToChat}
              className="bg-black text-white px-4 py-2 rounded-lg"
            >
              Chat
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobDetails;