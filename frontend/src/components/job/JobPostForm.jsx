import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTier } from '@/hooks/useTier';
import { toast } from 'sonner';

// Fraud detection utilities
const FRAUD_PATTERNS = {
  genericDescriptions: [
    'need someone to do the job',
    'looking for a worker',
    'as soon as possible',
    'urgent!!!',
    'cheap price',
  ],
  unrealisticRates: {
    'house cleaning': { min: 3000, max: 50000 },
    'plumbing': { min: 5000, max: 100000 },
    'electrical': { min: 5000, max: 150000 },
    'carpentry': { min: 10000, max: 500000 },
  },
};

function detectFraudSignals(formData) {
  const signals = [];
  
  // Check generic description
  const lowerDesc = formData.description.toLowerCase();
  const hasGeneric = FRAUD_PATTERNS.genericDescriptions.some(p => 
    lowerDesc.includes(p)
  );
  if (hasGeneric) signals.push({ type: 'warning', message: 'Description is very generic. Add specific details to attract quality artisans.' });

  // Check unrealistic budget
  const categoryRate = FRAUD_PATTERNS.unrealisticRates[formData.category];
  if (categoryRate) {
    if (formData.budget < categoryRate.min) {
      signals.push({ type: 'error', message: `Budget seems too low for ${formData.category}. Minimum: ₦${categoryRate.min}` });
    }
    if (formData.budget > categoryRate.max * 2) {
      signals.push({ type: 'warning', message: 'Budget is unusually high. Consider breaking into milestones.' });
    }
  }

  // Check impossible timeline
  const daysUntilDeadline = Math.ceil((new Date(formData.deadline) - new Date()) / (1000 * 60 * 60 * 24));
  if (daysUntilDeadline < 1) {
    signals.push({ type: 'error', message: 'Deadline cannot be less than 24 hours from now.' });
  }
  if (daysUntilDeadline > 90) {
    signals.push({ type: 'warning', message: 'Deadline is more than 3 months away. Consider posting closer to your need date.' });
  }

  return signals;
}

export function JobPostForm() {
  const { user } = useAuth();
  const { config, tier } = useTier(user);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    budget: '',
    deadline: '',
    location: '',
    requiresId: false,
    milestones: [],
  });
  
  const [fraudSignals, setFraudSignals] = useState([]);
  const [trustScore, setTrustScore] = useState(100);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => {
      const updated = { ...prev, [name]: newValue };
      
      // Auto-calculate milestones based on tier
      if (name === 'budget') {
        const amount = parseInt(value) || 0;
        const splitCount = config.escrowSplits.length;
        updated.milestones = config.escrowSplits.map((percent, i) => ({
          name: i === 0 ? 'Upfront/Deposit' : i === splitCount - 1 ? 'Final Delivery' : `Milestone ${i + 1}`,
          amount: Math.round(amount * (percent / 100)),
          percent,
        }));
      }
      
      return updated;
    });
  };

  const validateForm = () => {
    const signals = detectFraudSignals({
      ...formData,
      budget: parseInt(formData.budget) || 0,
    });
    setFraudSignals(signals);
    
    // Calculate trust score
    let score = 100;
    signals.forEach(s => {
      if (s.type === 'error') score -= 20;
      if (s.type === 'warning') score -= 10;
    });
    if (!formData.description || formData.description.length < 50) score -= 15;
    setTrustScore(Math.max(0, score));
    
    return !signals.some(s => s.type === 'error');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please fix the errors before posting');
      return;
    }

    if (trustScore < 60) {
      toast.warning('Your job post needs improvement. Add more details for better matches.');
      return;
    }

    // Submit to API
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          tier,
          trustScore,
          escrowMilestones: formData.milestones,
        }),
      });

      if (response.ok) {
        toast.success('Job posted successfully!');
        navigate('/customer/jobs');
      }
    } catch (error) {
      toast.error('Failed to post job');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Tier Badge */}
      <div className="bg-emerald-50 p-4 rounded-lg flex justify-between items-center">
        <div>
          <span className="text-sm text-gray-600">Your Tier:</span>
          <span className="ml-2 font-bold text-emerald-700 uppercase">{tier}</span>
        </div>
        <div className="text-sm text-gray-600">
          Max job value: <span className="font-semibold">₦{config.maxJobValue.toLocaleString()}</span>
        </div>
      </div>

      {/* Trust Score */}
      <div className={`p-4 rounded-lg ${trustScore >= 80 ? 'bg-green-50' : trustScore >= 60 ? 'bg-yellow-50' : 'bg-red-50'}`}>
        <div className="flex justify-between items-center">
          <span className="font-medium">Job Trust Score: {trustScore}/100</span>
          {trustScore < 60 && <span className="text-red-600 text-sm">Needs improvement</span>}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div 
            className={`h-2 rounded-full ${trustScore >= 80 ? 'bg-green-500' : trustScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
            style={{ width: `${trustScore}%` }}
          />
        </div>
      </div>

      {/* Fraud Signals */}
      {fraudSignals.length > 0 && (
        <div className="space-y-2">
          {fraudSignals.map((signal, idx) => (
            <div 
              key={idx}
              className={`p-3 rounded-lg text-sm ${
                signal.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {signal.type === 'error' ? '❌' : '⚠️'} {signal.message}
            </div>
          ))}
        </div>
      )}

      {/* Form Fields */}
      <div>
        <label className="block text-sm font-medium mb-1">Job Title *</label>
        <input
          name="title"
          value={formData.title}
          onChange={handleChange}
          className="w-full p-3 border rounded-lg"
          placeholder="e.g., Fix leaking bathroom pipe"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Category *</label>
        <select
          name="category"
          value={formData.category}
          onChange={handleChange}
          className="w-full p-3 border rounded-lg"
          required
        >
          <option value="">Select category</option>
          <option value="plumbing">Plumbing</option>
          <option value="electrical">Electrical</option>
          <option value="carpentry">Carpentry</option>
          <option value="house cleaning">House Cleaning</option>
          <option value="painting">Painting</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1">Description * (min 50 chars)</label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          className="w-full p-3 border rounded-lg h-32"
          placeholder="Describe the work needed, materials required, access details..."
          minLength={50}
          required
        />
        <span className="text-xs text-gray-500">{formData.description.length}/50+ characters</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Budget (₦) *</label>
          <input
            type="number"
            name="budget"
            value={formData.budget}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg"
            max={config.maxJobValue}
            required
          />
          {parseInt(formData.budget) > config.maxJobValue && (
            <p className="text-red-500 text-xs mt-1">
              Exceeds your tier limit. <a href="/customer/profile/verify" className="underline">Upgrade required</a>
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Deadline *</label>
          <input
            type="date"
            name="deadline"
            value={formData.deadline}
            onChange={handleChange}
            className="w-full p-3 border rounded-lg"
            min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
            required
          />
        </div>
      </div>

      {/* Milestone Preview */}
      {formData.milestones.length > 0 && parseInt(formData.budget) > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="font-medium mb-3">Payment Milestones ({tier} tier)</h4>
          <div className="space-y-2">
            {formData.milestones.map((milestone, idx) => (
              <div key={idx} className="flex justify-between items-center p-3 bg-white rounded border">
                <div>
                  <span className="font-medium">{milestone.name}</span>
                  <span className="text-sm text-gray-500 ml-2">({milestone.percent}%)</span>
                </div>
                <span className="font-semibold">₦{milestone.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Funds held in escrow until you approve each milestone
          </p>
        </div>
      )}

      {/* ID Verification Toggle (for high value) */}
      {parseInt(formData.budget) >= 50000 && tier !== 'gold' && (
        <div className="bg-blue-50 p-4 rounded-lg">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              name="requiresId"
              checked={formData.requiresId}
              onChange={handleChange}
              className="w-4 h-4"
            />
            <span className="text-sm">
              Require verified artisans only (recommended for jobs ≥₦50k)
            </span>
          </label>
        </div>
      )}

      <button
        type="submit"
        disabled={trustScore < 40 || parseInt(formData.budget) > config.maxJobValue}
        className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {trustScore < 40 ? 'Fix Errors to Post' : 'Post Job & Deposit to Escrow'}
      </button>
    </form>
  );
}