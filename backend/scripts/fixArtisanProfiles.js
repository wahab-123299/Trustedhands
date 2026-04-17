const mongoose = require('mongoose');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Import models
const User = require('../models/User');
const ArtisanProfile = require('../models/ArtisanProfile');

const fixArtisanProfiles = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all users with role 'artisan'
    const artisanUsers = await User.find({ role: 'artisan' });
    console.log(`Found ${artisanUsers.length} artisan users\n`);

    let created = 0;
    let existing = 0;
    let failed = 0;

    for (const user of artisanUsers) {
      // Check if profile already exists
      const existingProfile = await ArtisanProfile.findOne({ userId: user._id });
      
      if (!existingProfile) {
        try {
          // ✅ CORRECTED: Field names match schema exactly
          const profileData = {
            userId: user._id,
            
            // ✅ FIXED: Capital 'P' in Profession
            Profession: 'General Handyman',
            
            // ✅ FIXED: skills is required (array with at least 1 item)
            skills: ['General Repairs', 'Home Maintenance'],
            
            // ✅ FIXED: experienceYears uses correct enum
            experienceYears: '1-3',
            
            // ✅ FIXED: rate object with amount and period
            rate: {
              amount: 2000,
              period: 'job'  // enum: ['hour', 'day', 'job']
            },
            
            // ✅ FIXED: availability object instead of isAvailable
            availability: {
              status: 'available',  // enum: ['available', 'unavailable', 'busy']
              nextAvailableDate: null
            },
            
            // ✅ FIXED: workRadius instead of serviceArea
            workRadius: 'any',  // enum: ['5', '10', '20', '50', 'any']
            
            // ✅ FIXED: idVerification with correct idType enum
            idVerification: {
              idType: 'nin',  // enum: ['nin', 'drivers_license', 'voters_card', 'passport']
              idNumber: 'TEMP-' + Date.now(),
              documentImage: null,
              isVerified: false,
              submittedAt: new Date()
            },
            
            // ✅ FIXED: bio is optional but good to have
            bio: `Professional artisan - ${user.fullName}`,
            
            // ✅ FIXED: portfolioImages (empty array is fine, max 6 items)
            portfolioImages: [],
            
            // ✅ FIXED: averageRating instead of rating
            averageRating: 0,
            
            // ✅ FIXED: totalReviews instead of reviewCount
            totalReviews: 0,
            
            // ✅ FIXED: completedJobs instead of totalJobsCompleted
            completedJobs: 0,
            
            // Optional fields with defaults
            responseTime: 0,
            isCertified: false,
            canApplyForHighValueJobs: false
          };

          await ArtisanProfile.create(profileData);
          console.log(`✅ Created profile for: ${user.email}`);
          created++;
          
        } catch (err) {
          console.log(`❌ Failed for ${user.email}: ${err.message}`);
          
          // Show detailed validation errors
          if (err.errors) {
            Object.keys(err.errors).forEach(field => {
              console.log(`   - ${field}: ${err.errors[field].message}`);
            });
          }
          failed++;
        }
      } else {
        console.log(`⚠️ Profile already exists for: ${user.email}`);
        existing++;
      }
    }

    console.log(`\n========================================`);
    console.log(`Summary:`);
    console.log(`- Total artisan users: ${artisanUsers.length}`);
    console.log(`- Profiles created: ${created}`);
    console.log(`- Profiles already existed: ${existing}`);
    console.log(`- Failed: ${failed}`);
    console.log(`========================================\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
};

// Run the script
fixArtisanProfiles();