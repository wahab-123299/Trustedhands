import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  MapPin, 
  ArrowRight, 
  ArrowLeft, 
  CheckCircle,
  X,
  Plus,
  Briefcase
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { NIGERIAN_STATES, SKILL_CATEGORIES } from '@/types';
import { toast } from 'sonner';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState<'customer' | 'artisan'>('customer');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Custom skill input states
  const [customSkill, setCustomSkill] = useState('');
  const [showCustomSkillInput, setShowCustomSkillInput] = useState(false);

  const [formData, setFormData] = useState({
    // Common fields
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    state: '',
    city: '',
    address: '',

    // Artisan fields
    profession: '', // Initialize as empty string, never undefined/null
    skills: [] as string[],
    experienceYears: '',
    rateAmount: '',
    ratePeriod: 'job' as 'hour' | 'day' | 'job',
    bio: '',
    workRadius: 'any' as string,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // FIXED: Ensure profession is always a string
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // Debug log
    console.log(`Field ${name} changed to:`, value);

    setFormData((prev) => ({ 
      ...prev, 
      [name]: value ?? '' // Ensure never undefined/null
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    console.log(`Select changed: ${name} = ${value}`);
    setFormData((prev) => ({ ...prev, [name]: value ?? '' }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSkillToggle = (skill: string) => {
    setFormData((prev) => {
      const skills = prev.skills.includes(skill)
        ? prev.skills.filter((s) => s !== skill)
        : [...prev.skills, skill];
      return { ...prev, skills };
    });
  };

  // Handler for adding custom skill
  const handleAddCustomSkill = () => {
    if (customSkill.trim() && !formData.skills.includes(customSkill.trim())) {
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, customSkill.trim()]
      }));
      setCustomSkill('');
      setShowCustomSkillInput(false);
    }
  };

  // Handler for removing skill
  const handleRemoveSkill = (skillToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((skill) => skill !== skillToRemove)
    }));
  };

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^(0[7-9][0-1][0-9]{8}|\+234[7-9][0-1][0-9]{8})$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid Nigerian phone number (e.g., 08012345678)';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must contain uppercase, lowercase, and number';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.state) {
      newErrors.state = 'State is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    if (role === 'customer') return true;

    const newErrors: Record<string, string> = {};

    // FIXED: Check for empty string properly
    if (!formData.profession || formData.profession.trim() === '') {
      newErrors.profession = 'Please enter your profession or work title';
    }

    if (formData.skills.length === 0) {
      newErrors.skills = 'Please select at least one skill';
    }

    if (!formData.experienceYears || formData.experienceYears === '') {
      newErrors.experienceYears = 'Experience is required';
    }

    if (!formData.rateAmount || formData.rateAmount === '') {
      newErrors.rateAmount = 'Rate amount is required';
    } else if (parseInt(formData.rateAmount) < 500) {
      newErrors.rateAmount = 'Minimum rate is ₦500';
    }

    console.log('Step 3 validation:', { formData, newErrors });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    console.log('handleNext called, current step:', step);
    console.log('Current formData:', formData);
    console.log('Profession value:', formData.profession); // Debug log

    let isValid = false;

    if (step === 1) {
      isValid = validateStep1();
      console.log('Step 1 validation result:', isValid);
      if (isValid) {
        setStep(2);
      }
    } else if (step === 2) {
      isValid = validateStep2();
      console.log('Step 2 validation result:', isValid);
      if (isValid) {
        if (role === 'artisan') {
          setStep(3);
        } else {
          handleSubmit();
        }
      }
    } else if (step === 3) {
      isValid = validateStep3();
      console.log('Step 3 validation result:', isValid);
      if (isValid) {
        handleSubmit();
      }
    }

    if (!isValid) {
      console.log('Validation failed, current errors:', errors);
      toast.error('Please check your input and try again');
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    console.log('handleSubmit called');
    console.log('FormData before submit:', formData); // Debug log
    setIsLoading(true);
    setErrors({});

    try {
      const data: any = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        password: formData.password,
        role,
        location: {
          state: formData.state,
          city: formData.city.trim(),
          address: formData.address.trim() || '',
        },
      };

      if (role === 'artisan') {
        // FIXED: Ensure profession is always a string and trimmed
        data.profession = (formData.profession || '').trim();
        data.skills = formData.skills;
        data.experienceYears = formData.experienceYears;
        data.rate = {
          amount: parseInt(formData.rateAmount),
          period: formData.ratePeriod,
        };
        data.bio = formData.bio.trim() || '';
        data.workRadius = formData.workRadius || 'any';
      }

      console.log('Sending registration data:', data);

      const result = await register(data);
      console.log('Registration result:', result);

      toast.success('Registration successful! Please check your email to verify your account.');
      navigate('/login');
    } catch (error: any) {
      console.error('Registration error:', error);
      console.error('Error response:', error.response);

      // Handle validation errors from backend
      if (error.response?.data?.error?.details) {
        const backendErrors: Record<string, string> = {};
        error.response.data.error.details.forEach((err: any) => {
          backendErrors[err.field] = err.message;
        });
        setErrors(backendErrors);
        toast.error('Please fix the errors and try again.');
      } else if (error.response?.data?.error?.message) {
        toast.error(error.response.data.error.message);
      } else if (error.message) {
        toast.error(error.message);
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      {/* Role Selection */}
      <div className="space-y-2">
        <Label>I want to:</Label>
        <RadioGroup
          value={role}
          onValueChange={(value: 'customer' | 'artisan') => {
            setRole(value);
            setErrors({});
          }}
          className="grid grid-cols-2 gap-4"
        >
          <div>
            <RadioGroupItem value="customer" id="customer" className="peer sr-only" />
            <Label
              htmlFor="customer"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-gray-50 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 [&:has([data-state=checked])]:border-emerald-500 cursor-pointer"
            >
              <User className="mb-3 h-6 w-6" />
              Hire Artisans
            </Label>
          </div>
          <div>
            <RadioGroupItem value="artisan" id="artisan" className="peer sr-only" />
            <Label
              htmlFor="artisan"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-transparent p-4 hover:bg-gray-50 peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 [&:has([data-state=checked])]:border-emerald-500 cursor-pointer"
            >
              <CheckCircle className="mb-3 h-6 w-6" />
              Find Work
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <div className="relative">
          <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            id="fullName"
            name="fullName"
            placeholder="Enter your full name"
            className="pl-10"
            value={formData.fullName}
            onChange={handleChange}
          />
        </div>
        {errors.fullName && <p className="text-sm text-red-500">{errors.fullName}</p>}
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email"
            className="pl-10"
            value={formData.email}
            onChange={handleChange}
          />
        </div>
        {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            id="phone"
            name="phone"
            type="tel"
            placeholder="e.g., 08012345678"
            className="pl-10"
            value={formData.phone}
            onChange={handleChange}
          />
        </div>
        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a password (min 8 chars, uppercase, lowercase, number)"
            className="pl-10 pr-10"
            value={formData.password}
            onChange={handleChange}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
      </div>

      {/* Confirm Password */}
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm your password"
            className="pl-10 pr-10"
            value={formData.confirmPassword}
            onChange={handleChange}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
        {errors.confirmPassword && <p className="text-sm text-red-500">{errors.confirmPassword}</p>}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="state">State</Label>
        <Select value={formData.state} onValueChange={(value) => handleSelectChange('state', value)}>
          <SelectTrigger>
            <SelectValue placeholder="Select your state" />
          </SelectTrigger>
          <SelectContent>
            {NIGERIAN_STATES.map((state) => (
              <SelectItem key={state.name} value={state.name}>
                {state.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.state && <p className="text-sm text-red-500">{errors.state}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="city">City</Label>
        <Input
          id="city"
          name="city"
          placeholder="Enter your city"
          value={formData.city}
          onChange={handleChange}
        />
        {errors.city && <p className="text-sm text-red-500">{errors.city}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Address (Optional)</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
          <textarea
            id="address"
            name="address"
            placeholder="Enter your address"
            className="w-full min-h-[80px] px-10 py-2 rounded-md border border-input bg-transparent text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            value={formData.address}
            onChange={handleChange}
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      {/* Profession/Work Title - FIXED VERSION */}
      <div className="space-y-2">
        <Label htmlFor="profession">Profession / Work Title *</Label>
        <div className="relative">
          <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            id="profession"
            name="profession"
            type="text"
            placeholder="e.g., Solar Panel Installer, CNC Machinist, Drone Operator"
            className="pl-10"
            value={formData.profession || ''} // FIXED: Ensure never undefined/null
            onChange={handleChange}
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-gray-500">
          Enter your specific profession or work title. You can type anything that describes what you do.
        </p>
        {errors.profession && <p className="text-sm text-red-500">{errors.profession}</p>}
      </div>

      {/* Selected Skills Display */}
      {formData.skills.length > 0 && (
        <div className="space-y-2">
          <Label>Selected Skills ({formData.skills.length})</Label>
          <div className="flex flex-wrap gap-2">
            {formData.skills.map((skill) => (
              <Badge
                key={skill}
                variant="secondary"
                className="flex items-center gap-1 px-3 py-1"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(skill)}
                  className="ml-1 text-gray-500 hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Predefined Skills */}
      <div className="space-y-2">
        <Label>Select from Common Skills</Label>
        <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto border rounded-md p-2">
          {SKILL_CATEGORIES.filter(skill => !formData.skills.includes(skill)).map((skill) => (
            <label
              key={skill}
              className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={formData.skills.includes(skill)}
                onChange={() => handleSkillToggle(skill)}
                className="rounded border-gray-300 text-emerald-500 focus:ring-emerald-500"
              />
              <span className="text-sm">{skill}</span>
            </label>
          ))}
        </div>
        {errors.skills && <p className="text-sm text-red-500">{errors.skills}</p>}
      </div>

      {/* Add Custom Skill */}
      <div className="space-y-2">
        <Label>Can't find your skill?</Label>
        {!showCustomSkillInput ? (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setShowCustomSkillInput(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Custom Skill
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="Enter your skill (e.g., Solar Panel Installation)"
              value={customSkill}
              onChange={(e) => setCustomSkill(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomSkill())}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={handleAddCustomSkill}
              disabled={!customSkill.trim()}
              className="bg-emerald-500 hover:bg-emerald-600"
            >
              Add
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setShowCustomSkillInput(false);
                setCustomSkill('');
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      {/* Experience Years */}
      <div className="space-y-2">
        <Label htmlFor="experienceYears">Years of Experience</Label>
        <Select
          value={formData.experienceYears}
          onValueChange={(value) => handleSelectChange('experienceYears', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select experience" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0-1">0-1 years</SelectItem>
            <SelectItem value="1-3">1-3 years</SelectItem>
            <SelectItem value="3-5">3-5 years</SelectItem>
            <SelectItem value="5-10">5-10 years</SelectItem>
            <SelectItem value="10+">10+ years</SelectItem>
          </SelectContent>
        </Select>
        {errors.experienceYears && <p className="text-sm text-red-500">{errors.experienceYears}</p>}
      </div>

      {/* Rate */}
      <div className="space-y-2">
        <Label>Rate</Label>
        <div className="flex gap-2">
          <Input
            name="rateAmount"
            type="number"
            placeholder="Amount"
            value={formData.rateAmount}
            onChange={handleChange}
            className="flex-1"
          />
          <Select
            value={formData.ratePeriod}
            onValueChange={(value) => handleSelectChange('ratePeriod', value as 'hour' | 'day' | 'job')}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hour">/ hour</SelectItem>
              <SelectItem value="day">/ day</SelectItem>
              <SelectItem value="job">/ job</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {errors.rateAmount && <p className="text-sm text-red-500">{errors.rateAmount}</p>}
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Label htmlFor="bio">Bio (Optional)</Label>
        <textarea
          id="bio"
          name="bio"
          placeholder="Tell us about yourself and your work experience"
          maxLength={500}
          className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-transparent text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          value={formData.bio}
          onChange={handleChange}
        />
        <p className="text-xs text-gray-500">{formData.bio.length}/500 characters</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg mx-auto">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">T</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">TrustedHand</span>
          </Link>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">Create Account</CardTitle>
            <CardDescription className="text-center">
              {step === 1 && 'Enter your details to get started'}
              {step === 2 && 'Tell us where you are located'}
              {step === 3 && 'Complete your artisan profile'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Progress Indicator */}
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    s === step
                      ? 'bg-emerald-500 text-white'
                      : s < step
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {s < step ? <CheckCircle className="w-5 h-5" /> : s}
                </div>
              ))}
            </div>

            {/* Form Steps */}
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}

            {/* Navigation Buttons */}
            <div className="flex gap-4 mt-6">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleBack}
                  disabled={isLoading}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back
                </Button>
              )}
              <Button
                type="button"
                className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                onClick={handleNext}
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    {step === 3 || (step === 2 && role === 'customer') ? 'Create Account' : 'Next'}
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </div>

            {/* Sign In Link */}
            <p className="text-center text-sm text-gray-600 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-medium">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;