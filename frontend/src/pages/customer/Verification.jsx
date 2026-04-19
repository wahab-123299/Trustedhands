import { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTier, TIER_CONFIG } from '@/hooks/useTier';
import { toast } from 'sonner';
import { Camera, Upload, CheckCircle, AlertCircle, Shield, ChevronRight, ChevronLeft, Loader2, X } from 'lucide-react';

const STEPS = ['intro', 'identity', 'documents', 'review', 'processing', 'success'];

export default function CustomerVerificationPage() {
  const { user, updateUser } = useAuth();
  const { tier, nextTier, config } = useTier(user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnUrl = searchParams.get('return') || '/customer/dashboard';
  const requiredAmount = parseInt(searchParams.get('amount')) || 0;
  
  const [currentStep, setCurrentStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationMethod, setVerificationMethod] = useState('nin-bvn');
  
  const [formData, setFormData] = useState({
    nin: '',
    bvn: '',
    idType: 'drivers_license',
    idDocument: null,
    idDocumentPreview: null,
    videoSelfie: null,
    isRecording: false,
    videoBlob: null,
  });

  const [verificationResult, setVerificationResult] = useState(null);
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);

  const targetTier = nextTier || tier;
  const targetConfig = TIER_CONFIG[targetTier];

  // If already sufficient tier, redirect
  if (tier === 'gold' || (tier === 'silver' && requiredAmount <= 50000)) {
    navigate(returnUrl, { replace: true });
    return null;
  }

  const handleSkip = () => {
    // Allow downgrade posting
    if (requiredAmount > 0) {
      // Post with reduced amount or go back
      navigate(`/customer/post-job?maxAmount=${config.maxJobValue}`);
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

  const validateNIN = (nin) => /^\d{11}$/.test(nin);
  const validateBVN = (bvn) => /^\d{11}$/.test(bvn);

  const handleVerifyMeCheck = async () => {
    setIsProcessing(true);
    setCurrentStep(4);

    try {
      const response = await fetch('/api/verify/identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nin: formData.nin,
          bvn: formData.bvn,
          idType: formData.idType,
          userId: user.id,
          tier: targetTier,
        }),
      });

      const result = await response.json();

      if (result.verified) {
        setVerificationResult({
          success: true,
          reference: result.reference,
          timestamp: new Date().toISOString(),
        });
        
        await updateUser({ 
          verificationTier: targetTier,
          verifiedAt: new Date().toISOString(),
          verificationReference: result.reference,
        });
        
        setCurrentStep(5);
        toast.success(`Upgraded to ${targetConfig.name}!`);
      } else {
        throw new Error(result.message || 'Verification failed');
      }
    } catch (error) {
      toast.error(error.message || 'Verification failed. Please try again.');
      setCurrentStep(3);
    } finally {
      setIsProcessing(false);
    }
  };

  const canProceed = () => {
    switch (STEPS[currentStep]) {
      case 'intro':
        return true;
      case 'identity':
        if (verificationMethod === 'nin-bvn') {
          return validateNIN(formData.nin) && validateBVN(formData.bvn);
        }
        return formData.idDocument && formData.idType;
      case 'documents':
        return formData.videoSelfie;
      case 'review':
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (STEPS[currentStep]) {
      case 'intro':
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Verify Your Identity</h2>
              <p className="text-gray-600">Unlock higher-value jobs and build trust with artisans</p>
            </div>

            {/* Why verify - benefits */}
            <div className="bg-emerald-50 p-5 rounded-lg">
              <h3 className="font-semibold mb-3 text-emerald-800">Why verify?</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Post jobs up to ₦{targetConfig.maxJobValue.toLocaleString()}</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Secure milestone payments ({targetConfig.escrowSplits.length} stages)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>Priority dispute resolution (24h)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5" />
                  <span>"Verified" badge on your profile</span>
                </li>
              </ul>
            </div>

            {/* Current vs Target */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg border-2 border-gray-200">
                <span className="text-xs text-gray-500 uppercase">Current</span>
                <h4 className="font-bold uppercase">{config.name}</h4>
                <p className="text-sm text-gray-600">Up to ₦{config.maxJobValue.toLocaleString()}</p>
              </div>
              <div className="bg-emerald-50 p-4 rounded-lg border-2 border-emerald-200">
                <span className="text-xs text-emerald-600 uppercase">Upgrade To</span>
                <h4 className="font-bold uppercase text-emerald-800">{targetConfig.name}</h4>
                <p className="text-sm text-emerald-700">Up to ₦{targetConfig.maxJobValue.toLocaleString()}</p>
              </div>
            </div>

            {/* Time estimate */}
            <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
              <Loader2 className="w-4 h-4" />
              <span>Takes 2-3 minutes • Instant approval</span>
            </div>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={() => setCurrentStep(1)}
                className="w-full bg-emerald-600 text-white py-3 rounded-lg font-medium hover:bg-emerald-700"
              >
                Start Verification Now
              </button>
              
              <button
                onClick={handleSkip}
                className="w-full py-3 border rounded-lg hover:bg-gray-50 text-gray-600"
              >
                Skip for Now — Stay on {config.name}
              </button>
            </div>

            {/* Contextual message if they hit a limit */}
            {requiredAmount > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                <p className="text-sm text-yellow-800">
                  You tried to post a ₦{requiredAmount.toLocaleString()} job. 
                  Your current limit is ₦{config.maxJobValue.toLocaleString()}.
                </p>
              </div>
            )}

            <p className="text-xs text-center text-gray-400">
              Your data is secure. We use VerifyMe/YouVerify and never store raw NIN/BVN.
            </p>
          </div>
        );

      case 'identity':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Identity Verification</h2>
              <button onClick={handleSkip} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex gap-4 mb-6">
              <button
                onClick={() => setVerificationMethod('nin-bvn')}
                className={`flex-1 p-4 rounded-lg border-2 text-left ${
                  verificationMethod === 'nin-bvn' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
                }`}
              >
                <Shield className="w-6 h-6 mb-2 text-emerald-600" />
                <span className="font-medium block">NIN + BVN</span>
                <span className="text-sm text-gray-500">Instant (2 min)</span>
              </button>
              
              <button
                onClick={() => setVerificationMethod('documents')}
                className={`flex-1 p-4 rounded-lg border-2 text-left ${
                  verificationMethod === 'documents' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200'
                }`}
              >
                <Upload className="w-6 h-6 mb-2 text-emerald-600" />
                <span className="font-medium block">ID Documents</span>
                <span className="text-sm text-gray-500">Manual review (24h)</span>
              </button>
            </div>

            {verificationMethod === 'nin-bvn' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">National Identity Number (NIN)</label>
                  <input
                    type="text"
                    value={formData.nin}
                    onChange={(e) => setFormData({...formData, nin: e.target.value.replace(/\D/g, '').slice(0, 11)})}
                    className="w-full p-3 border rounded-lg"
                    placeholder="Enter 11-digit NIN"
                    maxLength={11}
                  />
                  {!validateNIN(formData.nin) && formData.nin.length > 0 && (
                    <p className="text-red-500 text-xs mt-1">NIN must be 11 digits</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Bank Verification Number (BVN)</label>
                  <input
                    type="text"
                    value={formData.bvn}
                    onChange={(e) => setFormData({...formData, bvn: e.target.value.replace(/\D/g, '').slice(0, 11)})}
                    className="w-full p-3 border rounded-lg"
                    placeholder="Enter 11-digit BVN"
                    maxLength={11}
                  />
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Verified via VerifyMe API. We never store your raw NIN/BVN.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">ID Type</label>
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
                  <label className="block text-sm font-medium mb-1">Upload ID Document</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                    {formData.idDocumentPreview ? (
                      <img src={formData.idDocumentPreview} alt="ID Preview" className="max-h-48 mx-auto mb-4 rounded" />
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
                      {formData.idDocument ? 'Change file' : 'Choose file'}
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'documents':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Video Selfie</h2>
              <button onClick={handleSkip} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Quick Instructions:</h4>
              <ol className="text-sm space-y-1 list-decimal list-inside">
                <li>Ensure good lighting on your face</li>
                <li>Remove glasses, hats, or masks</li>
                <li>Say: "My name is [your name], verifying for TrustedHand"</li>
                <li>Turn head slowly left and right</li>
              </ol>
            </div>

            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              
              {!formData.isRecording && !formData.videoSelfie && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={startVideoRecording}
                    className="bg-red-600 text-white px-6 py-3 rounded-full flex items-center gap-2 hover:bg-red-700"
                  >
                    <Camera className="w-5 h-5" />
                    Start Recording
                  </button>
                </div>
              )}

              {formData.isRecording && (
                <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm flex items-center gap-2">
                  <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  Recording...
                </div>
              )}

              {formData.videoSelfie && !formData.isRecording && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="text-center text-white">
                    <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-400" />
                    <p className="font-medium">Video recorded successfully</p>
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, videoSelfie: null, videoBlob: null }))}
                      className="mt-4 text-sm underline"
                    >
                      Record again
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 'review':
        return (
          <div className="space-y-6">
            <h2 className="text-xl font-bold">Review Your Information</h2>

            <div className="bg-gray-50 p-4 rounded-lg space-y-4">
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Target Tier</span>
                <span className="font-semibold uppercase">{targetConfig.name}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b">
                <span className="text-gray-600">Verification Method</span>
                <span className="font-semibold">
                  {verificationMethod === 'nin-bvn' ? 'NIN + BVN' : 'ID Documents'}
                </span>
              </div>

              {verificationMethod === 'nin-bvn' && (
                <>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">NIN</span>
                    <span className="font-mono">****{formData.nin.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-gray-600">BVN</span>
                    <span className="font-mono">****{formData.bvn.slice(-4)}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between py-2">
                <span className="text-gray-600">Video Verification</span>
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" /> Completed
                </span>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg flex gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm text-yellow-800">
                By proceeding, you consent to identity verification through VerifyMe/YouVerify. 
                Your raw NIN/BVN will not be stored on our servers.
              </p>
            </div>
          </div>
        );

      case 'processing':
        return (
          <div className="text-center py-12">
            <Loader2 className="w-16 h-16 text-emerald-600 mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-bold mb-2">Verifying Your Identity</h2>
            <p className="text-gray-600">This usually takes 30-60 seconds...</p>
            <div className="mt-6 max-w-xs mx-auto bg-gray-200 rounded-full h-2">
              <div className="bg-emerald-600 h-2 rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Verification Complete!</h2>
            <p className="text-gray-600 mb-2">You're now {targetConfig.name} tier</p>
            <p className="text-sm text-gray-500 mb-6">Reference: {verificationResult?.reference}</p>
            
            <div className="bg-emerald-50 p-4 rounded-lg max-w-sm mx-auto mb-6 text-left">
              <h4 className="font-medium mb-2">Your new benefits:</h4>
              <ul className="text-sm space-y-1">
                <li>• Post jobs up to ₦{targetConfig.maxJobValue === Infinity ? 'Unlimited' : targetConfig.maxJobValue.toLocaleString()}</li>
                <li>• {targetConfig.escrowSplits.length}-stage milestone payments</li>
                <li>• Priority support</li>
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
      {/* Progress Steps - hidden on intro and success */}
      {currentStep > 0 && currentStep < 5 && (
        <div className="flex items-center justify-between mb-8">
          {['Start', 'Identity', 'Video', 'Review'].map((label, idx) => (
            <div key={label} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                idx < currentStep ? 'bg-emerald-600 text-white' : 
                idx === currentStep ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                {idx < currentStep ? <CheckCircle className="w-4 h-4" /> : idx + 1}
              </div>
              <span className={`ml-2 text-sm hidden sm:block ${
                idx <= currentStep ? 'text-emerald-600' : 'text-gray-400'
              }`}>
                {label}
              </span>
              {idx < 3 && <ChevronRight className="w-4 h-4 mx-2 text-gray-300" />}
            </div>
          ))}
        </div>
      )}

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        {renderStep()}
      </div>

      {/* Navigation */}
      {currentStep > 0 && currentStep < 4 && (
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setCurrentStep(prev => prev - 1)}
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </button>
          <button
            onClick={() => currentStep === 3 ? handleVerifyMeCheck() : setCurrentStep(prev => prev + 1)}
            disabled={!canProceed() || isProcessing}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
          >
            {currentStep === 3 ? 'Submit for Verification' : 'Continue'}
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}