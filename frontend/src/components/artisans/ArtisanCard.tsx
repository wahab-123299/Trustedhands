import React from 'react';
import { MapPin, Building2, Star, ArrowRight, BadgeCheck } from 'lucide-react';

interface Artisan {
  _id?: string;
  id?: string;
  fullName?: string;
  name?: string;
  profileImage?: string;
  isVerified?: boolean;
  isCertified?: boolean;
  profession?: string;
  skills?: string[];
  location?: {
    city?: string;
    state?: string;
  };
  rate?: {
    amount?: number;
    period?: string;
  };
  hourlyRate?: number;
  ratePeriod?: string;
  averageRating?: number;
  rating?: number;
  totalReviews?: number;
  reviewCount?: number;
  completedJobs?: number;
  createdAt?: string;
  availabilityStatus?: string;
  isAvailable?: boolean;
}

interface ArtisanCardProps {
  artisan: Artisan;
  onViewProfile: (artisanId: string) => void;
}

const ArtisanCard: React.FC<ArtisanCardProps> = ({ artisan, onViewProfile }) => {
  // Get initials for avatar fallback
  const getInitials = (name?: string): string => {
    if (!name || name === 'Unknown Artisan') return '??';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Determine if artisan has a custom profile image (not default avatar)
  const hasProfileImage = !!artisan.profileImage && 
    artisan.profileImage !== '/default-avatar.png' && 
    artisan.profileImage !== '' &&
    !artisan.profileImage.includes('default');

  // Check if artisan is new (joined within last 30 days)
  const isNew = artisan.createdAt 
    ? (Date.now() - new Date(artisan.createdAt).getTime()) < (30 * 24 * 60 * 60 * 1000) 
    : false;

  // Format location
  const locationText = artisan.location?.city && artisan.location?.state 
    ? `${artisan.location.city}, ${artisan.location.state}`
    : artisan.location?.city || artisan.location?.state || 'Location not set';

  // Get display name
  const displayName = artisan.fullName || artisan.name || 'Unknown Artisan';

  // Format rate
  const rateAmount = artisan.rate?.amount || artisan.hourlyRate || 0;
  const ratePeriod = artisan.rate?.period || artisan.ratePeriod || 'job';
  const rateDisplay = rateAmount > 0 
    ? `₦${Number(rateAmount).toLocaleString()}/${ratePeriod}` 
    : null;

  // Rating
  const rating = artisan.averageRating || artisan.rating || 0;
  const reviews = artisan.totalReviews || artisan.reviewCount || 0;

  const artisanId = artisan._id || artisan.id || '';

  return (
    <div className="artisan-card">
      {/* Top Section with Background & Profile Image */}
      <div className="card-top">
        {/* New Badge - Top Right */}
        {isNew && (
          <div className="new-badge">
            <Star size={10} fill="#fbbf24" color="#fbbf24" />
            <span>New</span>
          </div>
        )}

        {/* Profile Image / Avatar */}
        <div className="profile-image-wrapper">
          {hasProfileImage && (
            <img 
              src={artisan.profileImage} 
              alt={displayName}
              className="profile-image"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                img.style.display = 'none';
                const fallback = img.nextElementSibling as HTMLElement | null;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          )}
          <div 
            className="avatar-fallback" 
            style={{ display: hasProfileImage ? 'none' : 'flex' }}
          >
            {getInitials(displayName)}
          </div>
        </div>
      </div>

      {/* Artisan Info */}
      <div className="card-body">
        {/* Name with Verification Badge */}
        <h3 className="artisan-name">
          {displayName}
          {(artisan.isVerified || artisan.isCertified) && (
            <BadgeCheck size={16} className="verified-badge" />
          )}
        </h3>

        {/* Profession */}
        <p className="profession-text">
          {artisan.profession || artisan.skills?.[0] || 'General Artisan'}
        </p>

        {/* Location */}
        <div className="info-row">
          <MapPin size={14} className="info-icon" />
          <span className="info-text">{locationText}</span>
        </div>

        {/* "New on TrustedHand" label */}
        {isNew && (
          <div className="info-row">
            <Building2 size={14} className="info-icon" />
            <span className="info-text">New on TrustedHand</span>
          </div>
        )}

        {/* Secondary New Tag */}
        {isNew && (
          <div className="new-tag">
            <Star size={10} fill="#fbbf24" color="#fbbf24" />
            <span>New</span>
          </div>
        )}

        {/* Rating */}
        {rating > 0 && (
          <div className="rating-row">
            <Star size={12} fill="#fbbf24" color="#fbbf24" />
            <span className="rating-text">{rating.toFixed(1)}</span>
            <span className="rating-count">({reviews} reviews)</span>
          </div>
        )}
      </div>

      {/* Bottom Section with Rate & Button */}
      <div className="card-footer">
        {rateDisplay && (
          <span className="rate-text">From <strong>{rateDisplay}</strong></span>
        )}
        <button 
          className="view-profile-btn"
          onClick={() => onViewProfile(artisanId)}
        >
          View Profile
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Styles */}
      <style>{`
        .artisan-card {
          background: linear-gradient(180deg, #1a2e1a 0%, #0f1f0f 100%);
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.06);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          display: flex;
          flex-direction: column;
          min-height: 360px;
        }

        .artisan-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
          border-color: rgba(16, 185, 129, 0.2);
        }

        /* Top Section */
        .card-top {
          position: relative;
          height: 140px;
          background: linear-gradient(135deg, #1a2e1a 0%, #0d2818 50%, #1a2e1a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* New Badge - Top Right */
        .new-badge {
          position: absolute;
          top: 12px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.3);
        }

        /* Profile Image */
        .profile-image-wrapper {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          overflow: hidden;
          border: 3px solid rgba(16, 185, 129, 0.3);
          background: #1a3a2a;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .profile-image {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .avatar-fallback {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 700;
          color: #10b981;
          background: linear-gradient(135deg, #1a3a2a 0%, #0d2818 100%);
        }

        /* Card Body */
        .card-body {
          padding: 16px 20px 12px;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .artisan-name {
          font-size: 15px;
          font-weight: 700;
          color: #ffffff;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .verified-badge {
          color: #10b981;
          flex-shrink: 0;
        }

        .profession-text {
          font-size: 13px;
          color: #10b981;
          font-weight: 500;
          margin: 0;
        }

        .info-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .info-icon {
          color: #6b7280;
          flex-shrink: 0;
        }

        .info-text {
          font-size: 13px;
          color: #9ca3af;
        }

        .new-tag {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(251, 191, 36, 0.1);
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 600;
          color: #fbbf24;
          border: 1px solid rgba(251, 191, 36, 0.2);
          width: fit-content;
          margin-top: 2px;
        }

        .rating-row {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
        }

        .rating-text {
          font-size: 12px;
          font-weight: 600;
          color: #fbbf24;
        }

        .rating-count {
          font-size: 12px;
          color: #6b7280;
        }

        /* Card Footer */
        .card-footer {
          padding: 12px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .rate-text {
          font-size: 13px;
          color: #9ca3af;
        }

        .rate-text strong {
          color: #ffffff;
          font-weight: 600;
        }

        .view-profile-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: #ffffff;
          font-size: 14px;
          font-weight: 600;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .view-profile-btn:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(16, 185, 129, 0.3);
        }

        .view-profile-btn:active {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
};

export default ArtisanCard;