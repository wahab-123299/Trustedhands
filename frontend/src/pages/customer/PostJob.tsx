import { useState } from 'react';
import CreatableSelect from 'react-select/creatable';
import { jobApi } from '@/services/api';
// Category options
const categoryOptions = [
  { value: 'Plumbing', label: 'Plumbing' },
  { value: 'Electrical', label: 'Electrical' },
  { value: 'Carpentry', label: 'Carpentry' },
  { value: 'Painting', label: 'Painting' },
  { value: 'Cleaning', label: 'Cleaning' },
  { value: 'Security', label: 'Security' },
  { value: 'Driving', label: 'Driving' },
  { value: 'Hairstyling', label: 'Hairstyling' },
  { value: 'Mechanics', label: 'Mechanics' },
  { value: 'Tiling', label: 'Tiling' },
  { value: 'Welding', label: 'Welding' },
  { value: 'POP', label: 'POP' },
  { value: 'Masonry', label: 'Masonry' },
  { value: 'AC Repair', label: 'AC Repair' },
  { value: 'Generator Repair', label: 'Generator Repair' },
  { value: 'Fridge Repair', label: 'Fridge Repair' },
  { value: 'TV Repair', label: 'TV Repair' },
  { value: 'Phone Repair', label: 'Phone Repair' },
  { value: 'Laptop Repair', label: 'Laptop Repair' },
  { value: 'Tailoring', label: 'Tailoring' },
  { value: 'Catering', label: 'Catering' },
  { value: 'Photography', label: 'Photography' },
  { value: 'Videography', label: 'Videography' },
  { value: 'Event Planning', label: 'Event Planning' },
  { value: 'HVAC', label: 'HVAC' },
  { value: 'Other', label: 'Other' },
];

// Custom styles to match your green theme
const customStyles = {
  control: (base: any) => ({
    ...base,
    borderRadius: '0.5rem',
    borderColor: '#e5e7eb',
    padding: '2px',
    '&:hover': { borderColor: '#10B981' },
    '&:focus-within': { 
      borderColor: '#10B981',
      boxShadow: '0 0 0 3px rgba(16, 185, 129, 0.1)'
    }
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected 
      ? '#10B981' 
      : state.isFocused 
        ? '#d1fae5' 
        : 'white',
    color: state.isSelected ? 'white' : '#374151',
    cursor: 'pointer'
  }),
  placeholder: (base: any) => ({
    ...base,
    color: '#9ca3af'
  })
};

export default function PostJob() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    title: '',
    category: '',
    description: '',
    budget: '',
    scheduledDate: '',
    location: {
      state: '',
      city: '',
      address: ''
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const jobData = {
        title: formData.title,
        description: formData.description,
        category: formData.category, // Now comes from CreatableSelect
        budget: parseFloat(formData.budget),
        budgetType: 'Fixed', // Add this to fix the 500 error
        scheduledDate: formData.scheduledDate,
        location: {
          state: formData.location.state,
          city: formData.location.city,
          address: formData.location.address || undefined
        }
      };

      await jobApi.create(jobData);
      // Success - redirect or show success message
      alert('Job posted successfully!');
      
      // Reset form
      setFormData({
        title: '',
        category: '',
        description: '',
        budget: '',
        scheduledDate: '',
        location: { state: '', city: '', address: '' }
      });
      setStep(1);
      
    } catch (err: any) {
      setError(err.message || 'Failed to create job');
      console.error('Job creation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (!formData.title || !formData.category || !formData.description) {
      setError('Please fill all required fields');
      return;
    }
    setError('');
    setStep(2);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">Post a New Job</h1>
      <p className="text-gray-600 mb-6">Describe your project and find the right artisan</p>

      {/* Progress indicator */}
      <div className="flex items-center mb-8">
        <div className={`flex items-center ${step === 1 ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 1 ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            1
          </div>
          <span className="ml-2 font-medium">Job Details</span>
        </div>
        <div className="flex-1 h-px bg-gray-200 mx-4"></div>
        <div className={`flex items-center ${step === 2 ? 'text-green-600' : 'text-gray-400'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 2 ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            2
          </div>
          <span className="ml-2 font-medium">Budget & Schedule</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Job Details</h2>
            
            {/* Job Title */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Job Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                placeholder="e.g., Professional Photoshoot for Wedding"
                maxLength={100}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {formData.title.length}/100
              </div>
            </div>

            {/* Category - REPLACED WITH CREATABLE SELECT */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Category <span className="text-red-500">*</span>
              </label>
              <CreatableSelect
                options={categoryOptions}
                value={formData.category ? { 
                  value: formData.category, 
                  label: formData.category 
                } : null}
                onChange={(newValue: any) => setFormData({
                  ...formData, 
                  category: newValue?.value || ''
                })}
                placeholder="Select or type a category"
                isClearable
                formatCreateLabel={(inputValue: string) => `+ Add "${inputValue}"`}
                styles={customStyles}
                className="react-select-container"
                classNamePrefix="react-select"
              />
              <p className="text-xs text-gray-500 mt-1">
                Choose from list or type your own category
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="Describe the job in detail. Include specific requirements, materials needed, and any other relevant information."
                maxLength={1000}
                rows={5}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
              />
              <div className="text-right text-xs text-gray-400 mt-1">
                {formData.description.length}/1000
              </div>
            </div>

            <button
              type="button"
              onClick={nextStep}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
            >
              Next Step
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Budget & Schedule</h2>
            
            {/* Budget */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Budget (₦) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.budget}
                onChange={(e) => setFormData({...formData, budget: e.target.value})}
                placeholder="Enter amount"
                min={1000}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Minimum budget: ₦1,000</p>
            </div>

            {/* Scheduled Date */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Scheduled Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.scheduledDate}
                onChange={(e) => setFormData({...formData, scheduledDate: e.target.value})}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
              />
            </div>

            {/* Location */}
            <div className="space-y-4">
              <h3 className="font-medium">Location</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">State *</label>
                  <input
                    type="text"
                    value={formData.location.state}
                    onChange={(e) => setFormData({
                      ...formData, 
                      location: {...formData.location, state: e.target.value}
                    })}
                    placeholder="e.g., Lagos"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">City *</label>
                  <input
                    type="text"
                    value={formData.location.city}
                    onChange={(e) => setFormData({
                      ...formData, 
                      location: {...formData.location, city: e.target.value}
                    })}
                    placeholder="e.g., Ikeja"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Address (Optional)</label>
                <input
                  type="text"
                  value={formData.location.address}
                  onChange={(e) => setFormData({
                    ...formData, 
                    location: {...formData.location, address: e.target.value}
                  })}
                  placeholder="Street address"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Posting...' : 'Post Job'}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}