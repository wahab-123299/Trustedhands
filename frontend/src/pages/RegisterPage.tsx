import { useState } from 'react';
import { Link } from 'react-router-dom';
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
import { loginWithGoogle, loginWithFacebook } from '@/services/api';
import { NIGERIAN_STATES, SKILL_CATEGORIES } from '@/types';
import { toast } from 'sonner';

const RegisterPage = () => {
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
    profession: '',
    skills: [] as string[],
    experienceYears: '',
    rateAmount: '',
    ratePeriod: 'job' as 'hour' | 'day' | 'job',
    bio: '',
    workRadius: 'any' as string,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: value ?? ''
    }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const handleSelectChange = (name: string, value: string) => {
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    let isValid = false;

    if (step === 1) {
      isValid = validateStep1();
      if (isValid) setStep(2);
    } else if (step === 2) {
      isValid = validateStep2();
      if (isValid) {
        if (role === 'artisan') {
          setStep(3);
        } else {
          handleSubmit();
        }
      }
    } else if (step === 3) {
      isValid = validateStep3();
      if (isValid) handleSubmit();
    }

    if (!isValid) {
      toast.error('Please check your input and try again');
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async () => {
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

      console.log('=== [REGISTER PAGE] SUBMITTING ===');
      console.log('Payload:', JSON.stringify(data, null, 2));

      await register(data);

      console.log('=== [REGISTER PAGE] SUCCESS ===');

    } catch (error: any) {
      console.error('=== [REGISTER PAGE] ERROR ===');
      console.error('Error object:', error);
      console.error('Error message:', error.message);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      let errorMsg = 'Registration failed. Please try again.';
      
      if (error.response?.data?.error?.details) {
        const backendErrors: Record<string, string> = {};
        error.response.data.error.details.forEach((err: any) => {
          backendErrors[err.field] = err.message;
        });
        setErrors(backendErrors);
        errorMsg = 'Please fix the errors and try again.';
      } else if (error.response?.data?.error?.message) {
        errorMsg = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message && error.message !== 'undefined') {
        errorMsg = error.message;
      }

      // Prevent misleading "Server waking up" message
      if (errorMsg.toLowerCase().includes('waking up') || 
          errorMsg.toLowerCase().includes('network')) {
        errorMsg = 'Registration failed. Please check your connection and try again.';
      }

      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // ==========================================
  // OAUTH HANDLERS
  // ==========================================
  const handleGoogleSignUp = () => {
    // Store intended role so backend knows what to create
    localStorage.setItem('oauth_role', role);
    localStorage.setItem('oauth_intent', 'register');
    localStorage.setItem('rememberMe', 'true');
    loginWithGoogle();
  };

  const handleFacebookSignUp = () => {
    localStorage.setItem('oauth_role', role);
    localStorage.setItem('oauth_intent', 'register');
    localStorage.setItem('rememberMe', 'true');
    loginWithFacebook();
  };

  const renderStep1 = () => (
    <div className="space-y-4">
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

      {/* OAuth Sign Up Buttons */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-white px-2 text-gray-500">Or sign up with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={handleGoogleSignUp}
          className="w-full"
          disabled={isLoading}
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleFacebookSignUp}
          className="w-full"
          disabled={isLoading}
        >
          <svg className="mr-2 h-4 w-4" fill="#1877F2" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
          Facebook
        </Button>
      </div>

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
            value={formData.profession || ''}
            onChange={handleChange}
            autoComplete="off"
          />
        </div>
        <p className="text-xs text-gray-500">
          Enter your specific profession or work title.
        </p>
        {errors.profession && <p className="text-sm text-red-500">{errors.profession}</p>}
      </div>

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
              placeholder="Enter your skill"
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

      <div className="space-y-2">
        <Label htmlFor="bio">Bio (Optional)</Label>
        <textarea
          id="bio"
          name="bio"
          placeholder="Tell us about yourself"
          maxLength={500}
          className="w-full min-h-[100px] px-3 py-2 rounded-md border border-input bg-transparent text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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

            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}

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