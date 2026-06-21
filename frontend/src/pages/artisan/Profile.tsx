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
  RefreshCw,
  Plus
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
  const [localArtisanProfile, setLocalArtisanProfile] = useState<any>(null);

  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    phone: user?.phone || '',
    email: user?.email || '',
    location: {
      state: user?.location?.state || '',
      city: user?.location?.city || '',
      address: user?.location?.address || ''
    },
    bio: '',
    skills: [] as string[],
    experienceYears: '',
    rate: {
      amount: 0,
      period: 'job' as 'hour' | 'day' | 'job'
    }
  });

  // Update form data when artisanProfile loads/changes
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
      setLocalArtisanProfile(artisanProfile);
    }
  }, [artisanProfile]);

  // Fallback fetch if artisanProfile is null but user is artisan
  useEffect(() => {
    const fetchArtisanProfile = async () => {
      if (user?.role === 'artisan' && !artisanProfile && !localArtisanProfile && !isLoadingProfile) {
        console.log('[Profile] No artisanProfile in context, fetching directly...');
        try {
          setIsLoadingProfile(true);
          const response = await artisanApi.getMyProfile();
          console.log('[Profile] Direct fetch response:', response.data);
          
          const fetchedArtisan = response.data?.data?.artisan;
          if (fetchedArtisan) {
            console.log('[Profile] Setting local artisan profile');
            setLocalArtisanProfile(fetchedArtisan);
            updateArtisanProfile(fetchedArtisan);
            setFormData(prev => ({
              ...prev,
              bio: fetchedArtisan.bio || '',
              skills: fetchedArtisan.skills || [],
              experienceYears: fetchedArtisan.experienceYears || '',
              rate: {
                amount: fetchedArtisan.rate?.amount || 0,
                period: fetchedArtisan.rate?.period || 'job'
              }
            }));
          }
        } catch (error: any) {
          console.error('[Profile] Direct fetch failed:', error);
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };

    fetchArtisanProfile();
  }, [user?.role, artisanProfile]);

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

  // ✅ FIXED: Handle both CREATE and UPDATE
  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Update user profile (always)
      const userUpdate = await userApi.updateMe({
        fullName: formData.fullName,
        phone: formData.phone,
        location: formData.location
      });

      updateUser(userUpdate.data.data);

      // ✅ FIXED: Check if we need to CREATE or UPDATE artisan profile
      const profileExists = artisanProfile || localArtisanProfile;
      
      if (user?.role === 'artisan') {
        const artisanData = {
          bio: formData.bio,
          skills: formData.skills,
          experienceYears: formData.experienceYears as '0-1' | '1-3' | '3-5' | '5-10' | '10+',
          rate: formData.rate
        };

        let artisanUpdate;
        
        if (profileExists) {
          // UPDATE existing profile
          console.log('[Profile] Updating existing artisan profile...');
          artisanUpdate = await artisanApi.updateProfile(artisanData);
        } else {
          // CREATE new profile (backend uses PUT for both create/update)
          console.log('[Profile] Creating new artisan profile...');
          artisanUpdate = await artisanApi.updateProfile(artisanData);
        }

        const updatedArtisan = artisanUpdate.data.data?.artisan || artisanUpdate.data.data;
        updateArtisanProfile(updatedArtisan);
        setLocalArtisanProfile(updatedArtisan);
        
        toast.success(profileExists ? 'Profile updated successfully' : 'Profile created successfully!');
        setIsEditing(false);
      }
    } catch (error: any) {
      console.error('[Profile] Save error:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to save profile');
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

  const activeArtisanProfile = artisanProfile || localArtisanProfile;
  const hasNoProfile = user?.role === 'artisan' && !activeArtisanProfile;

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

            {/* ✅ FIXED: Edit/Create Profile Button */}
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
              ) : hasNoProfile ? (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Profile
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

      {/* ✅ FIXED: Show creation form when no profile and editing */}
      {hasNoProfile && isEditing && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardHeader>
            <CardTitle className="text-emerald-800 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Create Your Artisan Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-emerald-700">
              Fill in your professional details below to start receiving job requests.
            </p>
            
            {/* Skills */}
            <div>
              <Label>Skills *</Label>
              <Input
                value={formData.skills.join(', ')}
                onChange={(e) => handleInputChange('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="e.g. Plumbing, Electrical, Carpentry"
                className="mt-2"
              />
              <p className="text-xs text-gray-500 mt-1">Separate multiple skills with commas</p>
            </div>

            {/* Experience */}
            <div>
              <Label>Experience Level *</Label>
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
            </div>

            {/* Rate */}
            <div>
              <Label>Rate (₦) *</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  type="number"
                  value={formData.rate.amount}
                  onChange={(e) => handleInputChange('rate', { ...formData.rate, amount: parseInt(e.target.value) || 0 })}
                  placeholder="Amount"
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
            </div>

            {/* Bio */}
            <div>
              <Label>Bio</Label>
              <textarea
                className="w-full p-3 border rounded-lg min-h-[120px] mt-2"
                value={formData.bio}
                onChange={(e) => handleInputChange('bio', e.target.value)}
                placeholder="Tell customers about your experience and expertise..."
              />
            </div>

            {/* Save Button */}
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
                Create Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs - Only show if profile exists or user is not editing */}
      {(!hasNoProfile || !isEditing) && (
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
              {activeArtisanProfile == null ? (
                <Card>
                  <CardContent className="p-6 text-center">
                    <h3 className="text-lg font-semibold mb-2">
                      Profile Not Found
                    </h3>
                    <p className="text-gray-500 mb-4 max-w-md mx-auto">
                      Your artisan profile hasn't been created yet. Click "Create Profile" above to get started.
                    </p>
                    <Button 
                      onClick={() => setIsEditing(true)} 
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create Profile
                    </Button>
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
                          {activeArtisanProfile.averageRating?.toFixed(1) || '0.0'}
                        </div>
                        <p className="text-sm text-emerald-600">Rating</p>
                      </div>
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-700">
                          {activeArtisanProfile.completedJobs || 0}
                        </p>
                        <p className="text-sm text-blue-600">Jobs Done</p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-700">
                          {activeArtisanProfile.experienceYears || 'N/A'}
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
                          onChange={(e) => handleInputChange('skills', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                          placeholder="Enter skills separated by commas"
                          className="mt-2"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {activeArtisanProfile.skills?.length > 0 ? (
                            activeArtisanProfile.skills.map((skill: string, idx: number) => (
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
                              onChange={(e) => handleInputChange('rate', { ...formData.rate, amount: parseInt(e.target.value) || 0 })}
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
                              ₦{activeArtisanProfile.rate?.amount?.toLocaleString() || 0} / {activeArtisanProfile.rate?.period || 'job'}
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
                            <span>{activeArtisanProfile.experienceYears || 'Not specified'}</span>
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
                            {activeArtisanProfile.bio || 'No bio added yet.'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Certification Status */}
                    {activeArtisanProfile.isCertified && (
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
      )}
    </div>
  );
};

export default Profile;