const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId;
    },
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  role: {
    type: String,
    enum: {
      values: ['customer', 'artisan'],
      message: 'Role must be either customer or artisan'
    },
    required: [true, 'Role is required']
  },
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    required: function() {
      return !this.googleId && !this.facebookId;
    },
    unique: true,
    sparse: true,
    match: [/^(0[7-9][0-1]\d{8}|\+234[7-9][0-1]\d{8})$/, 'Please enter a valid Nigerian phone number']
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  location: {
    state: {
      type: String,
      required: function() {
        return !this.googleId && !this.facebookId;
      },
      trim: true,
      enum: {
        values: [
          'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
          'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
          'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
          'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
          'Yobe', 'Zamfara'
        ],
        message: 'Please enter a valid Nigerian state'
      }
    },
    city: {
      type: String,
      required: function() {
        return !this.googleId && !this.facebookId;
      },
      trim: true
    },
    address: {
      type: String,
      trim: true,
      maxlength: [200, 'Address cannot exceed 200 characters']
    }
  },
  profileImage: {
    type: String,
    default: '/default-avatar.png',
    validate: {
      validator: function(v) {
        return !v || /^https?:\/\/.+/.test(v) || v.startsWith('/');
      },
      message: 'Invalid image URL format'
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  socketId: String,
  isOnline: {
    type: Boolean,
    default: false
  },
  refreshTokens: [{
    token: {
      type: String,
      select: false
    },
    createdAt: { 
      type: Date, 
      default: Date.now,
      expires: '7d'
    },
    deviceInfo: String
  }],
  blacklistedTokens: [{
    token: {
      type: String,
      select: false
    },
    blacklistedAt: { 
      type: Date, 
      default: Date.now,
      expires: '30d'
    }
  }],
  googleId: {
    type: String,
    sparse: true,
    unique: true,
    index: true
  },
  facebookId: {
    type: String,
    sparse: true,
    unique: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ role: 1, isActive: 1, 'location.state': 1, 'location.city': 1 });
userSchema.index({ fullName: 'text', 'location.city': 'text' });

// Virtual for artisan profile
userSchema.virtual('artisanProfile', {
  ref: 'ArtisanProfile',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// ==========================================
// PRE-SAVE HOOK — FIXED
// ==========================================
userSchema.pre('save', async function(next) {
  // Only hash if password is modified and exists
  if (!this.isModified('password') || !this.password) {
    return next();
  }
  
  // Validate minimum length before hashing
  if (this.password.length < 8) {
    return next(new Error('Password must be at least 8 characters'));
  }
  
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err);
  }
});

// ==========================================
// COMPARE PASSWORD — FIXED WITH FALLBACK
// ==========================================
userSchema.methods.comparePassword = async function(candidatePassword) {
  // OAuth users without password can't use password login
  if (!this.password) {
    console.log('[comparePassword] No password stored (OAuth user?)');
    return false;
  }
  
  // Check if it's a valid bcrypt hash
  const isBcryptHash = typeof this.password === 'string' && 
                       (this.password.startsWith('$2a$') || 
                        this.password.startsWith('$2b$') || 
                        this.password.startsWith('$2y$'));
  
  if (!isBcryptHash) {
    console.log('[comparePassword] WARNING: Password is NOT a bcrypt hash!');
    console.log('[comparePassword] Password type:', typeof this.password);
    console.log('[comparePassword] Password prefix:', this.password.substring(0, 20));
    
    // Fallback for plaintext passwords (auto-migrate to hash)
    const isMatch = this.password === candidatePassword;
    if (isMatch) {
      console.log('[comparePassword] Plaintext match! Re-hashing...');
      this.password = await bcrypt.hash(candidatePassword, 12);
      await this.save();
      console.log('[comparePassword] Re-hashed successfully.');
    }
    return isMatch;
  }
  
  // Normal bcrypt comparison
  try {
    const result = await bcrypt.compare(candidatePassword, this.password);
    console.log('[comparePassword] Bcrypt compare result:', result);
    return result;
  } catch (err) {
    console.error('[comparePassword] Bcrypt error:', err.message);
    return false;
  }
};

userSchema.methods.isTokenBlacklisted = function(token) {
  return this.blacklistedTokens.some(bt => bt.token === token);
};

userSchema.methods.blacklistToken = async function(token) {
  this.blacklistedTokens.push({ token });
  await this.save();
};

userSchema.methods.addRefreshToken = async function(token, deviceInfo = '') {
  if (this.refreshTokens.length >= 5) {
    this.refreshTokens.shift();
  }
  this.refreshTokens.push({ token, deviceInfo });
  await this.save();
};

userSchema.methods.removeRefreshToken = async function(token) {
  this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token);
  await this.save();
};

userSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

userSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

userSchema.statics.findArtisansByLocation = function(state, city, options = {}) {
  const query = {
    role: 'artisan',
    isActive: true,
    'location.state': state
  };
  
  if (city) query['location.city'] = city;
  if (options.isOnline) query.isOnline = true;
  
  return this.find(query)
    .populate('artisanProfile')
    .limit(options.limit || 20);
};

userSchema.statics.findOrCreateOAuthUser = async function(profile, provider) {
  const email = profile.emails?.[0]?.value;
  if (!email) throw new Error('Email not provided by OAuth provider');

  let user = await this.findOne({ email: email.toLowerCase() });

  if (user) {
    if (provider === 'google' && !user.googleId) {
      user.googleId = profile.id;
      await user.save();
    } else if (provider === 'facebook' && !user.facebookId) {
      user.facebookId = profile.id;
      await user.save();
    }
    return user;
  }

  const userData = {
    email: email.toLowerCase(),
    fullName: profile.displayName || `${profile.name?.givenName || ''} ${profile.name?.familyName || ''}`.trim(),
    profileImage: profile.photos?.[0]?.value || '/default-avatar.png',
    role: 'customer',
    isActive: true,
    isEmailVerified: true,
  };

  if (provider === 'google') {
    userData.googleId = profile.id;
  } else if (provider === 'facebook') {
    userData.facebookId = profile.id;
  }

  return await this.create(userData);
};

userSchema.methods.toJSON = function() {
  const obj = this.toObject();
  
  const sensitiveFields = [
    'password',
    'refreshTokens',
    'blacklistedTokens',
    'emailVerificationToken',
    'emailVerificationExpires',
    'passwordResetToken',
    'passwordResetExpires',
    'socketId',
    'googleId',
    'facebookId'
  ];
  
  sensitiveFields.forEach(field => delete obj[field]);
  
  return obj;
};

module.exports = mongoose.model('User', userSchema);