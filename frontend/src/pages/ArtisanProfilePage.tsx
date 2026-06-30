import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { userApi, artisanApi } from "@/services/api";
import { useState, useCallback, useEffect, ChangeEvent } from 'react';
import { useAuth } from "@/contexts/AuthContext";
import { ArtisanProfile } from "@/types";
import BankDetailsForm from "@/components/bank/BankDetailsForm";

// Form data interface (local shape for editing)
interface ArtisanFormData {
  skill: string;
  experience: number;
  bio: string;
  location: string;
  rateAmount: number;
  ratePeriod: "job" | "hour" | "day";
}

// Type guard for populated userId
const isPopulatedUser = (
  userId: string | { _id: string; fullName: string; location?: string } | null | undefined
): userId is { _id: string; fullName: string; location?: string } => {
  return typeof userId === 'object' && userId !== null && 'fullName' in userId;
};

const ArtisanProfilePage = () => {
  const { id } = useParams<{ id: string }>();
  const { user, artisanProfile, updateArtisanProfile } = useAuth();

  const [profile, setProfile] = useState<ArtisanProfile | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showBankSection, setShowBankSection] = useState(false);
  const [hasBankDetails, setHasBankDetails] = useState(false);
  const [form, setForm] = useState<ArtisanFormData>({
    skill: "",
    experience: 0,
    bio: "",
    location: "",
    rateAmount: 0,
    ratePeriod: "job",
  });

  // ==============================
  // FETCH PROFILE
  // ==============================

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);

      // If viewing own profile (no ID in URL)
      if (!id && artisanProfile) {
        setProfile(artisanProfile);
        
        // Check bank details
        try {
          const userRes = await userApi.getMe();
          const bankDetails = userRes.data.data?.bankDetails;
          setHasBankDetails(
            !!bankDetails?.accountNumber && 
            !!bankDetails?.bankCode
          );
        } catch {
          setHasBankDetails(false);
        }
        
        // Map app's ArtisanProfile type to form shape
        const userLocation = isPopulatedUser(artisanProfile.userId) 
          ? artisanProfile.userId.location 
          : "";
        
        setForm({
          skill: artisanProfile.skills?.[0] || "",
          experience: Number(artisanProfile.experienceYears) || 0,
          bio: artisanProfile.bio || "",
          location: userLocation || "",
          rateAmount: artisanProfile.rate?.amount || 0,
          ratePeriod: artisanProfile.rate?.period || "job",
        });
        return;
      }

      // Fetch another artisan's public profile
      if (id) {
        const response = await artisanApi.getPublicProfile(id);
        // Response shape: { success: true, data: { artisan: {...}, reviews: [...] } }
        setProfile(response.data.data.artisan);
        setReviews(response.data.data.reviews || []);
      }
    } catch (error: any) {
      console.error('Failed to load artisan profile:', error);
      toast.error(error?.response?.data?.error?.message || "Failed to load artisan profile");
    } finally {
      setLoading(false);
    }
  }, [id, artisanProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ==============================
  // UPDATE PROFILE
  // ==============================

  const handleUpdate = async () => {
    try {
      const getExperienceRange = (exp: number): "0-1" | "1-3" | "3-5" | "5-10" | "10+" => {
        if (exp <= 1) return "0-1";
        if (exp <= 3) return "1-3";
        if (exp <= 5) return "3-5";
        if (exp <= 10) return "5-10";
        return "10+";
      };

      const updateData = {
        skills: form.skill ? [form.skill] : [],
        experienceYears: getExperienceRange(form.experience),
        bio: form.bio,
        rate: {
          amount: form.rateAmount,
          period: form.ratePeriod,
        },
      };
      
      const response = await artisanApi.updateProfile(updateData);
      const updated = response.data.data?.artisan;

      setProfile(updated);
      updateArtisanProfile(updated);

      toast.success("Profile updated successfully");
      setEditing(false);
    } catch (error: any) {
      toast.error(error?.message || "Update failed");
    }
  };

  // ==============================
  // CONTACT ARTISAN
  // ==============================

  const handleContact = () => {
    if (!profile) return;
    
    const userId = isPopulatedUser(profile.userId) 
      ? profile.userId._id 
      : profile.userId;
      
    window.location.href = `/chat/${userId}`;
  };

  // ==============================
  // UI STATES
  // ==============================

  if (loading) {
    return <div className="p-6 text-center">Loading profile...</div>;
  }

  if (!profile) {
    return <div className="p-6 text-center">Profile not found</div>;
  }

  const isOwner = user?._id === (isPopulatedUser(profile.userId) ? profile.userId._id : profile.userId);

  // Get display data safely
  const userName = isPopulatedUser(profile.userId) ? profile.userId.fullName : 'Unknown';
  const userLocation = isPopulatedUser(profile.userId) ? profile.userId.location : '';

  // ==============================
  // UI
  // ==============================

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="bg-white shadow rounded-2xl p-6 space-y-4">
        {/* HEADER */}
        <div>
          <h1 className="text-2xl font-bold">
            {userName}
          </h1>
          <p className="text-gray-500">{userLocation || form.location}</p>
        </div>

        {/* RATING */}
        <div className="flex items-center gap-2">
          <span className="text-yellow-500">⭐</span>
          <span>
            {profile.averageRating || 0} ({profile.totalReviews || 0} reviews)
          </span>
        </div>

        {/* PROFESSION */}
        {profile.profession && (
          <div>
            <strong>Profession:</strong>{" "}
            <span className="text-blue-600">{profile.profession}</span>
          </div>
        )}

        {/* SKILL */}
        <div>
          <strong>Skills:</strong>{" "}
          {editing ? (
            <input
              value={form.skill}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, skill: e.target.value })
              }
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === ' ') {
                  e.nativeEvent.stopImmediatePropagation();
                }
              }}
              placeholder="e.g. Plumbing, Electrical"
              className="border p-2 rounded w-full mt-1"
            />
          ) : (
            <span>{profile.skills?.join(', ') || form.skill || 'Not specified'}</span>
          )}
        </div>

        {/* EXPERIENCE */}
        <div>
          <strong>Experience:</strong>{" "}
          {editing ? (
            <input
              type="number"
              value={form.experience}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm({
                  ...form,
                  experience: Number(e.target.value),
                })
              }
              className="border p-2 rounded w-full mt-1"
            />
          ) : (
            <span>{profile.experienceYears || form.experience || 'Not specified'}</span>
          )}
        </div>

        {/* RATE */}
        <div>
          <strong>Rate:</strong>{" "}
          {editing ? (
            <div className="space-y-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.rateAmount === 0 ? '' : form.rateAmount.toString()}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  setForm({ ...form, rateAmount: val === '' ? 0 : parseInt(val, 10) });
                }}
                placeholder="e.g. 5000"
                className="border p-2 rounded w-full mt-1"
              />
              <select
                value={form.ratePeriod}
                onChange={(e) => setForm({ ...form, ratePeriod: e.target.value as ArtisanFormData['ratePeriod'] })}
                className="border p-2 rounded w-full mt-1"
              >
                <option value="job">Per Job</option>
                <option value="hour">Per Hour</option>
                <option value="day">Per Day</option>
              </select>
            </div>
          ) : (
            <span>₦{profile.rate?.amount?.toLocaleString() || 0} / {profile.rate?.period || 'job'}</span>
          )}
        </div>

        {/* BIO */}
        <div>
          <strong>Bio:</strong>
          {editing ? (
            <textarea
              value={form.bio}
              onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                setForm({ ...form, bio: e.target.value })
              }
              className="border p-2 rounded w-full mt-1"
            />
          ) : (
            <p>{profile.bio || form.bio || 'No bio available'}</p>
          )}
        </div>

        {/* LOCATION */}
        <div>
          <strong>Location:</strong>{" "}
          {editing ? (
            <input
              value={form.location}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, location: e.target.value })
              }
              className="border p-2 rounded w-full mt-1"
            />
          ) : (
            <span>{userLocation || form.location || 'Not specified'}</span>
          )}
        </div>

        {/* AVAILABILITY */}
        {profile.availability && (
          <div>
            <strong>Availability:</strong>{" "}
            <span className={profile.availability.status === 'available' ? 'text-green-600' : 'text-red-500'}>
              {profile.availability.status === 'available' ? '✅ Available' : '❌ Unavailable'}
            </span>
            {profile.availability.nextAvailableDate && (
              <span className="text-gray-500 ml-2">
                (Next: {new Date(profile.availability.nextAvailableDate).toLocaleDateString()})
              </span>
            )}
          </div>
        )}

        {/* PORTFOLIO IMAGES */}
        {profile.portfolioImages && profile.portfolioImages.length > 0 && (
          <div>
            <strong>Portfolio:</strong>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {profile.portfolioImages.map((img: string, idx: number) => (
                <img 
                  key={idx} 
                  src={img} 
                  alt={`Portfolio ${idx + 1}`}
                  className="w-full h-32 object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}

        {/* ACTIONS */}
        <div className="flex gap-3 pt-4 flex-wrap">
          {/* OWNER ACTIONS */}
          {isOwner && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Edit Profile
            </button>
          )}

          {isOwner && editing && (
            <>
              <button
                onClick={handleUpdate}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditing(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500"
              >
                Cancel
              </button>
            </>
          )}

          {/* OTHER USERS */}
          {!isOwner && (
            <button
              onClick={handleContact}
              className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
            >
              Contact Artisan
            </button>
          )}
        </div>
      </div>

      {/* REVIEWS SECTION */}
      {reviews.length > 0 && (
        <div className="bg-white shadow rounded-2xl p-6">
          <h3 className="font-semibold text-lg mb-4">Recent Reviews</h3>
          <div className="space-y-4">
            {reviews.map((review: any, idx: number) => (
              <div key={idx} className="border-b pb-4 last:border-0">
                <div className="flex items-center gap-3 mb-2">
                  {review.customerImage && (
                    <img src={review.customerImage} alt="" className="w-10 h-10 rounded-full" />
                  )}
                  <div>
                    <p className="font-medium">{review.customerName || 'Anonymous'}</p>
                    <div className="flex text-yellow-500">
                      {[...Array(5)].map((_, i) => (
                        <span key={i}>{i < review.rating ? '★' : '☆'}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-gray-600">{review.comment || 'No comment'}</p>
                <p className="text-sm text-gray-400 mt-1">
                  {review.completedAt ? new Date(review.completedAt).toLocaleDateString() : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BANK DETAILS SECTION - Only for owner */}
      {isOwner && (
        <div className="bg-white shadow rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-lg">Bank Account Details</h3>
              <p className="text-sm text-gray-500">
                Required for withdrawals. 
                {hasBankDetails 
                  ? " ✓ Account connected" 
                  : " ⚠️ Not set up yet"}
              </p>
            </div>
            <button
              onClick={() => setShowBankSection(!showBankSection)}
              className="text-blue-600 text-sm underline"
            >
              {showBankSection ? "Hide" : hasBankDetails ? "Update" : "Add"}
            </button>
          </div>

          {showBankSection && (
            <BankDetailsForm
              embedded={true}
              onSuccess={() => {
                setHasBankDetails(true);
                toast.success("Bank details saved!");
              }}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default ArtisanProfilePage;