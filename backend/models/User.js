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
    required: [true, 'Password is required'],
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
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^(0[7-9][0-1]\d{8}|\+234[7-9][0-1]\d{8})$/, 'Please enter a valid Nigerian phone number (e.g., 08012345678 or +2348012345678)']
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  location: {
    state: {
      type: String,
      required: [true, 'State is required'],
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
      required: [true, 'City is required'],
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
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ==========================================
// INDEXES
// ==========================================

// Compound index for common artisan queries
userSchema.index({ role: 1, isActive: 1, 'location.state': 1, 'location.city': 1 });

// Text index for search functionality
userSchema.index({ fullName: 'text', 'location.city': 'text' });

// Virtual for artisan profile
userSchema.virtual('artisanProfile', {
  ref: 'ArtisanProfile',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// ==========================================
// MIDDLEWARE
// ==========================================

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  if (this.password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// ==========================================
// INSTANCE METHODS
// ==========================================

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
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

// ==========================================
// STATIC METHODS
// ==========================================

userSchema.statics.findByEmailWithPassword = function(email) {
  return this.findOne({ email }).select('+password');
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

// ==========================================
// TOJSON TRANSFORM
// ==========================================

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
    'socketId'
  ];
  
  sensitiveFields.forEach(field => delete obj[field]);
  
  return obj;
};

module.exports = mongoose.model('User', userSchema);