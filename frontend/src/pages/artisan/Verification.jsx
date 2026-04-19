import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTier, TIER_CONFIG } from '@/hooks/useTier';
import { toast } from 'sonner';
import { 
  Camera, Upload, CheckCircle, AlertCircle, Shield, 
  ChevronRight, ChevronLeft, Loader2, X, Building2, 
  MapPin, Briefcase 
} from 'lucide-react';

const ARTISAN_STEPS = ['intro', 'personal-id', 'business-verify', 'skills', 'review', 'processing', 'success'];

export default function ArtisanVerificationPage() {
  const { user, updateUser } = useAuth();
  const { tier, nextTier, config } = useTier(user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('return') || '/artisan/dashboard';
  const jobId = searchParams.get('jobId'); // If they tried to apply to a specific job
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [businessType, setBusinessType] = useState('individual');
  
  const [formData, setFormData] = useState({
    nin: '',
    bvn: '',
    idType: 'drivers_license',
    idDocument: null,
    idDocumentPreview: null,
    videoSelfie: null,
    videoBlob: null,
    isRecording: false,
    
    hasCAC: false,
    cacNumber: '',
    cacDocument: null,
    cacDocumentPreview: null,
    businessName: '',
    businessAddress: '',
    shopGPS: null,
    
    primarySkill: '',
    yearsExperience: '',
    portfolioPhotos: [],
  });

  const [verificationResult, setVerificationResult] = useState(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  const targetTier = nextTier || tier;
  const targetConfig = TIER_CONFIG[targetTier];

  // Redirect if already sufficient
  if (tier === 'gold') {
    navigate(returnUrl, { replace: true });
    return null;
  }

  const handleSkip = () => {
    if (jobId) {
      // Save intent to apply, remind later
      toast.info('You can complete verification later from your profile');
      navigate(`/artisan/jobs?highlight=${jobId}`);
    } else {
      navigate(returnUrl);
    }
  };

  const handleFileChange = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({
          ...prev,
          [field]: file,
          [`${field}Preview`]: reader.result
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMultipleFiles = (e) => {
    const files = Array.from(e.target.files);
    const newPhotos = [];
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newPhotos.push({ file, preview: reader.result });
        if (newPhotos.length === files.length) {
          setFormData(prev => ({ 
            ...prev, 
            portfolioPhotos: [...prev.portfolioPhotos, ...newPhotos].slice(0, 5) 
          }));
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const startVideoRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      const chunks = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        setFormData(prev => ({ ...prev, videoBlob: blob, videoSelfie: true }));
      };

      mediaRecorder.start();
      setFormData(prev => ({ ...prev, isRecording: true }));
      setTimeout(() => stopVideoRecording(), 5000);
    } catch (error) {
      toast.error('Could not access camera. Please allow camera permissions.');
    }
  };

  const stopVideoRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
    setFormData(prev => ({ ...prev, isRecording: false }));
  };

  const captureShopLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          shopGPS: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: new Date().toISOString(),
          }
        }));
        toast.success('Location captured successfully');
      },
      (error) => {
        toast.error('Could not get location. Please enable GPS.');
      },
      { enableHighAccuracy: true }
    );
  };

  const validateNIN = (nin) => /^\d{11}$/.test(nin);
  const validateBVN = (bvn) => /^\d{11}$/.test(bvn);
  const validateCAC = (cac) => /^[A-Z0-9]{5,}$/i.test(cac);

  const handleVerificationSubmit = async () => {
    setIsProcessing(true);
    setCurrentStep(5);

    try {
      const payload = {
        userId: user.id,
        tier: targetTier,
        personal: {
          nin: formData.nin,
          bvn: formData.bvn,
          idType: formData.idType,
        },
        business: businessType === 'registered' ? {
          hasCAC: true,
          cacNumber: formData.cacNumber,
          businessName: formData.businessName,
          businessAddress: formData.businessAddress,
        } : {
          hasCAC: false,
          shopGPS: formData.shopGPS,
          businessAddress: formData.businessAddress,
        },
        skills: {
          primarySkill: formData.primarySkill,
          yearsExperience: parseInt(formData.yearsExperience),
          portfolioCount: formData.portfolioPhotos.length,
        },
      };

      const response = await fetch('/api/artisan/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.verified) {
        setVerificationResult({
          success: true,
          reference: result.reference,
          tier: targetTier,
        });
        
        await updateUser({ 
          verificationTier: targetTier,
          verifiedAt: new Date().toISOString(),
          verificationReference: result.reference,
          businessType,
          ...(businessType === 'registered' && { cacNumber: formData.cacNumber }),
        });
        
        setCurrentStep(6);
        toast.success(`Welcome to ${targetConfig.name} tier!`);
      } else {
        throw new Error(result.message || 'Verification failed');
      }
    } catch (error) {
      toast.error(error.message || 'Verification failed. Please try again.');
      setCurrentStep(4);
    } finally {
      setIsProcessing(false);
    }
  };

  const canProceed = () => {
    switch (ARTISAN_STEPS[currentStep]) {
      case 'intro':
        return true;
      case 'personal-id':
        return validateNIN(formData.nin) && validateBVN(formData.bvn) && formData.idDocument && formData.videoSelfie;
      case 'business-verify':
        if (businessType === 'registered') {
          return validateCAC(formData.cacNumber) && formData.cacDocument && formData.businessName && formData.businessAddress;
        }
        return formData.shopGPS && formData.businessAddress;
      case 'skills':
        return formData.primarySkill && formData.yearsExperience && formData.portfolioPhotos.length >= 2;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (ARTISAN_STEPS[currentStep]) {
      case 'intro':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Artisan Verification</h2>
              <p className="text-gray-600">Unlock premium jobs and build customer trust</p>
            </div>

            {/* Benefits */}
            <div className="bg-emerald-50 p-5 rounded-lg">
              <h3 className="font-semibold mb-3 text-emerald-800">Why verify?</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Access jobs up to ₦{targetConfig.maxJobValue.toLocaleString()}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>"Verified Pro" badge on your profile</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Priority in customer search results</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Faster payment release (3-day vs 7-day)</span>
                </li>
              </ul>
            </div>

            {/* Tier comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                <span className="text-xs text-gray-500 uppercase">Current</span>
                <h4 className="font-bold uppercase">{config.name}</h4>
                <p className="text-sm text-gray-600">Up to ₦{config.maxJobValue.toLocaleString()}/job</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200">
                <span className="text-xs text-emerald-600 uppercase">Unlock</span>
                <h4 className="font-bold uppercase text-emerald-800">{targetConfig.name}</h4>
                <p className="text-sm text-emerald-700">Up to ₦{targetConfig.maxJobValue.toLocaleString()}/job</p>
              </div>
            </div>

            {/* Time estimate */}
            <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
              <Loader2 className="w-4 h-4" />
              <span>Takes 5-7 minutes • Instant or 24h for manual review</span>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={() => setCurrentStep(1)}
                className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700"
              >
                Start Verification
              </button>
              
              <button
                onClick={handleSkip}
                className="w-full py-3 border rounded-lg hover:bg-gray-50 text-gray-600"
              >
                Complete Later — Browse Basic Jobs
              </button>
            </div>

            {/* Context if they tried to apply to premium job */}
            {jobId && (
              <div className="bg-yellow-50 p-4 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  This job requires {targetConfig.name} tier. You can complete verification now or save this job and apply later.
                </p>
              </div>
            )}

            <p className="text-xs text-center text-gray-400">
              Your data is secure. Government IDs verified via API; no raw data stored.
            </p>
          </div>
        );

      case 'personal-id':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Personal Identity</h2>
              <button onClick={handleSkip} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">National Identity Number (NIN) *</label>
                <input
                  type="text"
                  value={formData.nin}
                  onChange={(e) => setFormData({...formData, nin: e.target.value.replace(/\D/g, '').slice(0, 11)})}
                  className="w-full p-3 border rounded-lg"
                  placeholder="11-digit NIN"
                  maxLength={11}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Bank Verification Number (BVN) *</label>
                <input
                  type="text"
                  value={formData.bvn}
                  onChange={(e) => setFormData({...formData, bvn: e.target.value.replace(/\D/g, '').slice(0, 11)})}
                  className="w-full p-3 border rounded-lg"
                  placeholder="11-digit BVN"
                  maxLength={11}
                />
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" />
                  Verified via VerifyMe. Raw data not stored.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">ID Type *</label>
                <select
                  value={formData.idType}
                  onChange={(e) => setFormData({...formData, idType: e.target.value})}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="drivers_license">Driver's License</option>
                  <option value="passport">International Passport</option>
                  <option value="voters_card">Voter's Card</option>
                  <option value="national_id">National ID Card</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Upload ID Document *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  {formData.idDocumentPreview ? (
                    <img src={formData.idDocumentPreview} alt="ID" className="max-h-48 mx-auto mb-4 rounded" />
                  ) : (
                    <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileChange(e, 'idDocument')}
                    className="hidden"
                    id="id-upload"
                  />
                  <label htmlFor="id-upload" className="cursor-pointer text-emerald-600 hover:underline">
                    {formData.idDocument ? 'Change file' : 'Upload ID'}
                  </label>
                </div>
              </div>

              {/* Video */}
              <div>
                <label className="block text-sm font-medium mb-1">Video Verification *</label>
                <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  {!formData.isRecording && !formData.videoSelfie && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <button
                        onClick={startVideoRecording}
                        className="bg-red-600 text-white px-4 py-2 rounded-full flex items-center gap-2"
                      >
                        <Camera className="w-4 h-4" /> Record
                      </button>
                    </div>
                  )}
                  {formData.isRecording && (
                    <div className="absolute top-2 left-2 bg-red-600 text-white px-3 py-1 rounded-full text-xs">
                      Recording...
                    </div>
                  )}
                  {formData.videoSelfie && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <CheckCircle className="w-12 h-12 text-green-400" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">Say: "My name is [name], artisan on TrustedHand"</p>
              </div>
            </div>
          </div>
        );

      case 'business-verify':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Business Verification</h2>
              <button onClick={handleSkip} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setBusinessType('individual')}
                className={`flex-1 p-4 rounded-lg border-2 text-left ${
                  businessType === 'individual' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
                }`}
              >
                <Briefcase className="w-6 h-6 mb-2 text-emerald-600" />
                <span className="font-medium block">Individual Artisan</span>
                <span className="text-sm text-gray-500">No CAC registration</span>
              </button>
              
              <button
                onClick={() => setBusinessType('registered')}
                className={`flex-1 p-4 rounded-lg border-2 text-left ${
                  businessType === 'registered' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
                }`}
              >
                <Building2 className="w-6 h-6 mb-2 text-emerald-600" />
                <span className="font-medium block">Registered Business</span>
                <span className="text-sm text-gray-500">Have CAC number</span>
              </button>
            </div>

            {businessType === 'registered' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">CAC Registration Number *</label>
                  <input
                    type="text"
                    value={formData.cacNumber}
                    onChange={(e) => setFormData({...formData, cacNumber: e.target.value.toUpperCase()})}
                    className="w-full p-3 border rounded-lg"
                    placeholder="BN123456 or RC1234567"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Business Name (as on CAC) *</label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                    className="w-full p-3 border rounded-lg"
                    placeholder="Registered business name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">CAC Certificate *</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {formData.cacDocumentPreview ? (
                      <img src={formData.cacDocumentPreview} alt="CAC" className="max-h-48 mx-auto mb-4 rounded" />
                    ) : (
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    )}
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => handleFileChange(e, 'cacDocument')}
                      className="hidden"
                      id="cac-upload"
                    />
                    <label htmlFor="cac-upload" className="cursor-pointer text-emerald-600 hover:underline">
                      Upload CAC Certificate
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Shop Location
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    We verify your workshop location for customer trust.
                  </p>
                  
                  <button
                    onClick={captureShopLocation}
                    className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    <MapPin className="w-4 h-4" />
                    {formData.shopGPS ? 'Update Location' : 'Capture GPS Location'}
                  </button>
                  
                  {formData.shopGPS && (
                    <div className="mt-3 p-3 bg-white rounded border text-sm">
                      <p className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> Captured
                      </p>
                      <p className="text-gray-500 text-xs">
                        {formData.shopGPS.lat.toFixed(6)}, {formData.shopGPS.lng.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Workshop/Business Address *</label>
              <textarea
                value={formData.businessAddress}
                onChange={(e) => setFormData({...formData, businessAddress: e.target.value})}
                className="w-full p-3 border rounded-lg h-24"
                placeholder="Full address where you work"
                required
              />
            </div>
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Skills & Portfolio</h2>
              <button onClick={handleSkip} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Primary Skill/Trade *</label>
                <select
                  value={formData.primarySkill}
                  onChange={(e) => setFormData({...formData, primarySkill: e.target.value})}
                  className="w-full p-3 border rounded-lg"
                  required
                >
                  <option value="">Select your trade...</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical Work</option>
                  <option value="carpentry">Carpentry</option>
                  <option value="painting">Painting</option>
                  <option value="tiling">Tiling</option>
                  <option value="cleaning">Cleaning Services</option>
                  <option value="hvac">HVAC/Refrigeration</option>
                  <option value="welding">Welding & Metalwork</option>
                  <option value="automotive">Automotive Repair</option>
                  <option value="electronics">Electronics Repair</option>
                  <option value="hairdressing">Hairdressing/Barbing</option>
                  <option value="tailoring">Tailoring/Fashion</option>
                  <option value="catering">Catering/Cooking</option>
                  <option value="photography">Photography</option>
                  <option value="event_decor">Event Decoration</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Years of Experience *</label>
                <input
                  type="number"
                  value={formData.yearsExperience}
                  onChange={(e) => setFormData({...formData, yearsExperience: e.target.value})}
                  className="w-full p-3 border rounded-lg"
                  min="0"
                  max="50"
                  placeholder="e.g., 5"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Portfolio Photos (2-5) *</label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleMultipleFiles}
                    className="hidden"
                    id="portfolio-upload"
                  />
                  <label htmlFor="portfolio-upload" className="cursor-pointer text-emerald-600 hover:underline block mb-2">
                    Upload work samples
                  </label>
                  <p className="text-xs text-gray-500">Show your best work. Customers see these.</p>
                </div>
                
                {formData.portfolioPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-4">
                    {formData.portfolioPhotos.map((photo, idx) => (
                      <div key={idx} className="relative aspect-square">
                        <img src={photo.preview} alt="" className="w-full h-full object-cover rounded" />
                        <button
                          onClick={() => setFormData(prev => ({
                            ...prev,
                            portfolioPhotos: prev.portfolioPhotos.filter((_, i) => i !== idx)
                          }))}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                
                <p className="text-sm text-gray-500 mt-2">
                  {formData.portfolioPhotos.length}/5 photos
                </p>
              </div>
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Review & Submit</h2>

            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Target Tier</span>
                <span className="font-semibold uppercase">{targetConfig.name}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Identity</span>
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Verified
                </span>
              </div>

              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Business Type</span>
                <span className="font-medium">
                  {businessType === 'registered' ? `CAC: ${formData.cacNumber}` : 'Individual + GPS'}
                </span>
              </div>

              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Skill</span>
                <span className="font-medium">{formData.primarySkill} ({formData.yearsExperience} yrs)</span>
              </div>

              <div className="flex justify-between py-2">
                <span className="text-gray-600">Portfolio</span>
                <span className="font-medium">{formData.portfolioPhotos.length} photos</span>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Verification Commitment</p>
                <p>All information verified through government databases. False information results in permanent ban.</p>
              </div>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 text-emerald-600 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-bold mb-2">Verifying Your Information</h2>
            <p className="text-gray-600">Checking NIMC, CAC, and documents...</p>
            <p className="text-sm text-gray-500 mt-2">This may take 2-5 minutes</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">You're Verified!</h2>
            <p className="text-gray-600 mb-2">Welcome to {targetConfig.name} tier</p>
            
            <div className="bg-emerald-50 p-4 rounded-lg max-w-sm mx-auto mb-6 text-left">
              <h4 className="font-medium mb-2">What's next:</h4>
              <ul className="text-sm space-y-1">
                <li>• Access higher-paying jobs</li>
                <li>• "Verified" badge on profile</li>
                <li>• Priority in search results</li>
                <li>• Faster payment releases</li>
              </ul>
            </div>

            <button
              onClick={() => navigate(returnUrl)}
              className="bg-emerald-600 text-white px-8 py-3 rounded-lg hover:bg-emerald-700"
            >
              Continue
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Progress */}
      {currentStep > 0 && currentStep < 5 && (
        <div className="flex items-center justify-between mb-8 overflow-x-auto">
          {['Start', 'Identity', 'Business', 'Skills', 'Review'].map((label, idx) => (
            <div key={label} className="flex items-center flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                idx < currentStep ? 'bg-emerald-600 text-white' : 
                idx === currentStep ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {idx < currentStep ? <CheckCircle className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`ml-2 text-sm hidden sm:block ${idx <= currentStep ? 'text-emerald-600' : 'text-gray-400'}`}>
                {label}
              </span>
              {idx < 4 && <ChevronRight className="w-4 h-4 mx-2 text-gray-300" />}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        {renderStep()}
      </div>

      {/* Navigation */}
      {currentStep > 0 && currentStep < 5 && (
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setCurrentStep(prev => prev - 1)}
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={() => currentStep === 4 ? handleVerificationSubmit() : setCurrentStep(prev => prev + 1)}
            disabled={!canProceed() || isProcessing}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {currentStep === 4 ? 'Submit Verification' : 'Continue'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}