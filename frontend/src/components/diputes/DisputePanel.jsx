export function DisputePanel({ jobId, milestones, onResolve }) {
  const [activeDispute, setActiveDispute] = useState(null);
  
  const openDispute = (milestoneIndex) => {
    setActiveDispute({
      milestoneIndex,
      type: '',
      evidence: [],
      desiredOutcome: '',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="font-bold text-lg mb-4">Payment & Disputes</h3>
      
      {/* Milestone Status */}
      <div className="space-y-3 mb-6">
        {milestones.map((m, idx) => (
          <div key={idx} className="flex justify-between items-center p-3 border rounded">
            <div>
              <span className="font-medium">{m.name}</span>
              <span className="text-sm text-gray-500 ml-2">₦{m.amount.toLocaleString()}</span>
            </div>
            <div className="flex gap-2">
              {m.status === 'pending' && (
                <>
                  <button 
                    onClick={() => onResolve(idx, 'approved')}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded text-sm"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => openDispute(idx)}
                    className="px-3 py-1 bg-red-100 text-red-700 rounded text-sm"
                  >
                    Dispute
                  </button>
                </>
              )}
              {m.status === 'approved' && (
                <span className="text-green-600 text-sm">✓ Released</span>
              )}
              {m.status === 'disputed' && (
                <span className="text-orange-600 text-sm">⚠ Under Review</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Dispute Form Modal */}
      {activeDispute && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md w-full">
            <h4 className="font-bold mb-4">Open Dispute: {milestones[activeDispute.milestoneIndex].name}</h4>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Issue Type</label>
                <select 
                  className="w-full p-2 border rounded"
                  onChange={(e) => setActiveDispute({...activeDispute, type: e.target.value})}
                >
                  <option value="">Select issue</option>
                  <option value="incomplete">Work incomplete</option>
                  <option value="quality">Quality below standard</option>
                  <option value="delay">Missed deadline</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Evidence (photos, chat screenshots)</label>
                <input type="file" multiple accept="image/*" className="w-full" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Desired Outcome</label>
                <select className="w-full p-2 border rounded">
                  <option value="full_refund">Full refund</option>
                  <option value="partial">Partial refund (specify %)</option>
                  <option value="continue">Ask worker to complete</option>
                </select>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  onClick={() => setActiveDispute(null)}
                  className="flex-1 py-2 border rounded"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => {
                    onResolve(activeDispute.milestoneIndex, 'disputed', activeDispute);
                    setActiveDispute(null);
                  }}
                  className="flex-1 py-2 bg-red-600 text-white rounded"
                >
                  Submit Dispute
                </button>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 mt-4">
              Disputes under ₦20k resolved in 24h. Higher amounts: 72h.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}