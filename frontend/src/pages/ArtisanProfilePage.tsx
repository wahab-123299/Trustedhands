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
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showBankSection, setShowBankSection] = useState(false);
  const [hasBankDetails, setHasBankDetails] = useState(false);
  const [form, setForm] = useState<ArtisanFormData>({
    skill: "",
    experience: 0,
    bio: "",
    location: "",
  });

  // ==============================
  // FETCH PROFILE
  // ==============================

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);

      // If viewing own profile
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
        });
        return;
      }

      // Fetch another artisan
      if (id) {
        const response = await userApi.getArtisanById(id);
        setProfile(response.data.data);
      }
    } catch (error) {
      toast.error("Failed to load artisan profile");
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

        {/* SKILL */}
        <div>
          <strong>Skill:</strong>{" "}
          {editing ? (
            <input
              value={form.skill}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                setForm({ ...form, skill: e.target.value })
              }
              className="border p-2 rounded w-full mt-1"
            />
          ) : (
            <span>{profile.skills?.join(', ') || form.skill}</span>
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
            <span>{profile.experienceYears || form.experience} years</span>
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
            <p>{profile.bio || form.bio}</p>
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
            <span>{userLocation || form.location}</span>
          )}
        </div>

        {/* ACTIONS */}
        <div className="flex gap-3 pt-4 flex-wrap">
          {/* OWNER ACTIONS */}
          {isOwner && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg"
            >
              Edit Profile
            </button>
          )}

          {isOwner && editing && (
            <>
              <button
                onClick={handleUpdate}
                className="bg-green-600 text-white px-4 py-2 rounded-lg"
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditing(false)}
                className="bg-gray-400 text-white px-4 py-2 rounded-lg"
              >
                Cancel
              </button>
            </>
          )}

          {/* OTHER USERS */}
          {!isOwner && (
            <button
              onClick={handleContact}
              className="bg-black text-white px-4 py-2 rounded-lg"
            >
              Contact Artisan
            </button>
          )}
        </div>
      </div>

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