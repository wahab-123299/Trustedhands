import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { applicationsApi } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

// ==============================
// TYPES
// ==============================

interface Job {
  _id: string;
  title: string;
  budget: number;
  status: string;
  location: {
    city: string;
    state: string;
  };
}

interface Application {
  _id: string;
  job: Job;
  status: "pending" | "accepted" | "rejected";
  message?: string;
  proposedRate?: number;
  createdAt: string;
}

// ==============================
// COMPONENT
// ==============================

const ArtisanApplications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  // ==============================
  // FETCH APPLICATIONS
  // ==============================

  const fetchApplications = useCallback(async () => {
    try {
      setLoading(true);
      
      const params = filter !== "all" ? { status: filter } : {};
      const response = await applicationsApi.getMyApplications(params);
      
      setApplications(response.data.data?.applications || []);
    } catch (error: any) {
      toast.error(error?.message || "Failed to load applications");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  // ==============================
  // ACTIONS
  // ==============================

  const handleWithdraw = async (applicationId: string) => {
    try {
      await applicationsApi.withdrawApplication(applicationId);
      toast.success("Application withdrawn");
      fetchApplications();
    } catch (error: any) {
      toast.error(error?.message || "Failed to withdraw");
    }
  };

  const goToJob = (jobId: string) => {
    navigate(`/jobs/${jobId}`);
  };

  const goToChat = (jobId: string) => {
    navigate(`/chat/job/${jobId}`);
  };

  // ==============================
  // UI STATES
  // ==============================

  if (loading) {
    return <div className="p-6 text-center">Loading applications...</div>;
  }

  // ==============================
  // UI
  // ==============================

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">My Applications</h1>

      {/* Filter */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {["all", "pending", "accepted", "rejected"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg capitalize ${
              filter === status
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {applications.length === 0 ? (
        <div className="text-center text-gray-500 py-10">
          <p className="mb-4">You haven't applied to any jobs yet</p>
          <button
            onClick={() => navigate("/jobs")}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg"
          >
            Browse Jobs
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <div
              key={app._id}
              className="bg-white shadow rounded-xl p-4 flex flex-col gap-3"
            >
              {/* Job Info */}
              <div>
                <h2 
                  className="font-semibold text-lg cursor-pointer hover:text-blue-600"
                  onClick={() => goToJob(app.job._id)}
                >
                  {app.job.title}
                </h2>
                <p className="text-sm text-gray-500">
                  {app.job.location.city}, {app.job.location.state} • Budget: ₦{app.job.budget?.toLocaleString()}
                </p>
              </div>

              {/* Application Details */}
              <div className="text-sm space-y-1">
                <p>
                  <strong>Your Rate:</strong>{" "}
                  {app.proposedRate 
                    ? `₦${app.proposedRate.toLocaleString()}` 
                    : "Not specified"}
                </p>
                {app.message && (
                  <p><strong>Message:</strong> {app.message}</p>
                )}
                <p>
                  Applied: {new Date(app.createdAt).toLocaleDateString()}
                </p>
              </div>

              {/* Status */}
              <div className="text-sm">
                Status:{" "}
                <span
                  className={`capitalize font-medium ${
                    app.status === "accepted"
                      ? "text-green-600"
                      : app.status === "rejected"
                      ? "text-red-600"
                      : "text-yellow-600"
                  }`}
                >
                  {app.status}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                {app.status === "pending" && (
                  <button
                    onClick={() => handleWithdraw(app._id)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg"
                  >
                    Withdraw
                  </button>
                )}

                <button
                  onClick={() => goToChat(app.job._id)}
                  className="bg-black text-white px-4 py-2 rounded-lg"
                >
                  Chat
                </button>

                <button
                  onClick={() => goToJob(app.job._id)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg"
                >
                  View Job
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArtisanApplications;