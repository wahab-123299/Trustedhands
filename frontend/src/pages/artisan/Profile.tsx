import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Camera, 
  Edit2, 
  Save, 
  X,
  Loader2,
  Star,
  Briefcase,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { userApi, artisanApi } from '@/services/api';

// Nigerian States
const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara'
];

const Profile: React.FC = () => {
  const { user, artisanProfile, updateUser, updateArtisanProfile, refreshUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    email: user?.email || '',
    location: {
      state: user?.location?.state || '',
      city: user?.location?.city || '',
      address: user?.location?.address || ''
    },
    // Artisan fields - match backend field names
    bio: artisanProfile?.bio || '',
    skills: artisanProfile?.skills || [],
    experienceYears: artisanProfile?.experienceYears || '',
    rate: {
      amount: artisanProfile?.rate?.amount || 0,
      period: artisanProfile?.rate?.period || 'job'
    }
  });

  // ✅ FIXED: Update form data when artisanProfile loads/changes
  useEffect(() => {
    if (artisanProfile) {
      setFormData(prev => ({
        ...prev,
        bio: artisanProfile.bio || '',
        skills: artisanProfile.skills || [],
        experienceYears: artisanProfile.experienceYears || '',
        rate: {
          amount: artisanProfile.rate?.amount || 0,
          period: artisanProfile.rate?.period || 'job'
        }
      }));
    }
  }, [artisanProfile]);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleLocationChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      location: {
        ...prev.location,
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Update user profile
      const userUpdate = await userApi.updateMe({
        fullName: formData.fullName,
        phone: formData.phone,
        location: formData.location
      });

      updateUser(userUpdate.data.data);

      // Update artisan profile if applicable
      if (user?.role === 'artisan' && artisanProfile) {
        const artisanUpdate = await artisanApi.updateProfile({
          bio: formData.bio,
          skills: formData.skills,
          experienceYears: formData.experienceYears as '0-1' | '1-3' | '3-5' | '5-10' | '10+',
          rate: formData.rate
        });

        updateArtisanProfile(artisanUpdate.data.data.artisan);
      }

      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const response = await userApi.uploadProfileImage(file);
      updateUser({ profileImage: response.data.data.profileImage });
      toast.success('Profile photo updated');
    } catch (error: any) {
      toast.error('Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRefreshProfile = async () => {
    try {
      setIsLoadingProfile(true);
      await refreshUser();
      toast.success('Profile refreshed');
    } catch (error) {
      toast.error('Failed to refresh profile');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U';
  };

  const getRoleBadge = () => {
    if (user?.role === 'artisan') {
      return (
        <Badge className="bg-emerald-100 text-emerald-800">
          <Briefcase className="w-3 h-3 mr-1" />
          Verified Artisan
        </Badge>
      );
    }
    return (
      <Badge className="bg-blue-100 text-blue-800">
        <User className="w-3 h-3 mr-1" />
        Customer
      </Badge>
    );
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-6">
            {/* Avatar */}
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={user.profileImage} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-2xl">
                  {getInitials(user.fullName)}
                </AvatarFallback>
              </Avatar>
              <Button
                size="icon"
                variant="secondary"
                className="absolute bottom-0 right-0 rounded-full w-8 h-8"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            {/* Info */}
            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold">{user.fullName}</h1>
                {getRoleBadge()}
              </div>
              <p className="text-gray-600">{user.email}</p>
              <p className="text-gray-600">{user.phone}</p>

              {user.isEmailVerified && (
                <Badge variant="outline" className="mt-2 text-green-600 border-green-200">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Email Verified
                </Badge>
              )}
            </div>

            {/* Edit Button */}
            <Button
              variant={isEditing ? 'outline' : 'default'}
              onClick={() => isEditing ? setIsEditing(false) : setIsEditing(true)}
              className={isEditing ? '' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {isEditing ? (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Edit2 className="w-4 h-4 mr-2" />
                  Edit Profile
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="personal">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="personal">Personal Info</TabsTrigger>
          {user.role === 'artisan' && (
            <TabsTrigger value="professional">Professional</TabsTrigger>
          )}
        </TabsList>

        {/* Personal Info */}
        <TabsContent value="personal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  {isEditing ? (
                    <Input
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <User className="w-4 h-4 text-gray-400" />
                      <span>{user.fullName}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Email</Label>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{user.email}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  {isEditing ? (
                    <Input
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{user.phone}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>State</Label>
                  {isEditing ? (
                    <select
                      className="w-full p-2 border rounded-lg"
                      value={formData.location.state}
                      onChange={(e) => handleLocationChange('state', e.target.value)}
                    >
                      <option value="">Select State</option>
                      {NIGERIAN_STATES.map(state => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{user.location?.state}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>City / Address</Label>
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        placeholder="City"
                        value={formData.location.city}
                        onChange={(e) => handleLocationChange('city', e.target.value)}
                      />
                      <Input
                        placeholder="Detailed Address"
                        value={formData.location.address}
                        onChange={(e) => handleLocationChange('address', e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>
                        {user.location?.city}
                        {user.location?.address && `, ${user.location.address}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Professional Info (Artisan Only) */}
        {user.role === 'artisan' && (
          <TabsContent value="professional" className="mt-6">
            {!artisanProfile ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">
                    Professional Profile Not Loaded
                  </h3>
                  <p className="text-gray-500 mb-4 max-w-md mx-auto">
                    Your artisan profile data couldn't be loaded. This might be because the profile hasn't been created yet or there was a connection issue.
                  </p>
                  <div className="flex gap-3 justify-center">
                    <Button 
                      onClick={handleRefreshProfile} 
                      disabled={isLoadingProfile}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {isLoadingProfile ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      Refresh Profile
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => window.location.reload()}
                    >
                      Reload Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Professional Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-emerald-50 rounded-lg">
                      <div className="flex items-center justify-center gap-1 text-2xl font-bold text-emerald-700">
                        <Star className="w-5 h-5 fill-current" />
                        {artisanProfile.averageRating?.toFixed(1) || '0.0'}
                      </div>
                      <p className="text-sm text-emerald-600">Rating</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-700">
                        {artisanProfile.completedJobs || 0}
                      </p>
                      <p className="text-sm text-blue-600">Jobs Done</p>
                    </div>
                    <div className="text-center p-4 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-700">
                        {artisanProfile.experienceYears}
                      </p>
                      <p className="text-sm text-purple-600">Experience</p>
                    </div>
                  </div>

                  {/* Skills */}
                  <div>
                    <Label>Skills</Label>
                    {isEditing ? (
                      <Input
                        value={formData.skills.join(', ')}
                        onChange={(e) => handleInputChange('skills', e.target.value.split(',').map(s => s.trim()))}
                        placeholder="Enter skills separated by commas"
                        className="mt-2"
                      />
                    ) : (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {artisanProfile.skills?.length > 0 ? (
                          artisanProfile.skills.map((skill, idx) => (
                            <Badge key={idx} variant="secondary">
                              {skill}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-gray-400 text-sm">No skills added</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rate */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <Label>Rate</Label>
                      {isEditing ? (
                        <div className="flex gap-2 mt-2">
                          <Input
                            type="number"
                            value={formData.rate.amount}
                            onChange={(e) => handleInputChange('rate', { ...formData.rate, amount: parseInt(e.target.value) })}
                          />
                          <select
                            className="border rounded-lg px-3"
                            value={formData.rate.period}
                            onChange={(e) => handleInputChange('rate', { ...formData.rate, period: e.target.value })}
                          >
                            <option value="hour">/hour</option>
                            <option value="day">/day</option>
                            <option value="job">/job</option>
                          </select>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg mt-2">
                          <span className="font-semibold">
                            ₦{artisanProfile.rate?.amount?.toLocaleString() || 0} / {artisanProfile.rate?.period || 'job'}
                          </span>
                        </div>
                      )}
                    </div>

                    <div>
                      <Label>Experience Level</Label>
                      {isEditing ? (
                        <select
                          className="w-full p-2 border rounded-lg mt-2"
                          value={formData.experienceYears}
                          onChange={(e) => handleInputChange('experienceYears', e.target.value)}
                        >
                          <option value="">Select Experience</option>
                          <option value="0-1">0-1 years</option>
                          <option value="1-3">1-3 years</option>
                          <option value="3-5">3-5 years</option>
                          <option value="5-10">5-10 years</option>
                          <option value="10+">10+ years</option>
                        </select>
                      ) : (
                        <div className="p-3 bg-gray-50 rounded-lg mt-2">
                          <span>{artisanProfile.experienceYears || 'Not specified'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bio */}
                  <div>
                    <Label>Bio</Label>
                    {isEditing ? (
                      <textarea
                        className="w-full p-3 border rounded-lg min-h-[120px] mt-2"
                        value={formData.bio}
                        onChange={(e) => handleInputChange('bio', e.target.value)}
                        placeholder="Tell customers about your experience and expertise..."
                      />
                    ) : (
                      <div className="p-4 bg-gray-50 rounded-lg mt-2">
                        <p className="text-gray-700 whitespace-pre-wrap">
                          {artisanProfile.bio || 'No bio added yet.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Certification Status */}
                  {artisanProfile.isCertified && (
                    <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <span className="text-emerald-800 font-medium">Certified Artisan</span>
                    </div>
                  )}

                  {isEditing && (
                    <div className="flex justify-end gap-2 pt-4 border-t">
                      <Button variant="outline" onClick={() => setIsEditing(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSave}
                        disabled={isSaving}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        {isSaving ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-2" />
                        )}
                        Save Changes
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};


export default Profile;
