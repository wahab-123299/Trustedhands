import { useState } from 'react';
import { jobApi } from '@/services/api';
import { toast } from 'sonner';
import { Loader2, XCircle } from 'lucide-react';

interface CancelJobButtonProps {
  jobId: string;
  jobStatus: string;
  onCancelSuccess?: () => void;
}

export const CancelJobButton = ({ jobId, jobStatus, onCancelSuccess }: CancelJobButtonProps) => {
  const [isCancelling, setIsCancelling] = useState(false);

  // Only allow cancel for these statuses
  const canCancel = ['pending', 'open', 'assigned'].includes(jobStatus);
  if (!canCancel) return null;

  const handleCancel = async () => {
    // Simple confirmation dialog
    if (!confirm('Are you sure you want to cancel this job? This action cannot be undone.')) {
      return;
    }
    
    try {
      setIsCancelling(true);
      await jobApi.cancel(jobId, 'Cancelled by customer');
      toast.success('Job cancelled successfully');
      onCancelSuccess?.(); // Refresh parent component
    } catch (error: any) {
      const message = error.response?.data?.error?.message || 'Failed to cancel job';
      toast.error(message);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <button
      onClick={handleCancel}
      disabled={isCancelling}
      className="border border-red-300 text-red-600 px-6 py-3 rounded-lg font-medium hover:bg-red-50 transition-colors disabled:opacity-50 flex items-center gap-2"
    >
      {isCancelling ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Cancelling...
        </>
      ) : (
        <>
          <XCircle className="w-4 h-4" />
          Cancel Job
        </>
      )}
    </button>
  );
};