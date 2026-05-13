const mongoose = require('mongoose');

// ==========================================
// STEP 1: Create models/Favorite.js
// ==========================================

const favoriteSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  artisanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Customer's personal note about this artisan
  note: {
    type: String,
    maxlength: [500, 'Note cannot exceed 500 characters'],
    trim: true
  },
  // Tags for organization
  tags: [{
    type: String,
    maxlength: [30, 'Tag cannot exceed 30 characters'],
    trim: true
  }],
  // Has this customer hired this artisan before?
  hiredBefore: {
    type: Boolean,
    default: false
  },
  // Number of times hired
  hireCount: {
    type: Number,
    default: 0,
    min: 0
  },
  // Customer's personal rating (separate from public review)
  personalRating: {
    type: Number,
    min: 1,
    max: 5,
    default: null
  },
  // Last interaction date
  lastInteractedAt: {
    type: Date,
    default: Date.now
  },
  // When was this artisan favorited
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound unique index: one favorite per customer-artisan pair
favoriteSchema.index({ customerId: 1, artisanId: 1 }, { unique: true });
favoriteSchema.index({ customerId: 1, hiredBefore: 1 });
favoriteSchema.index({ customerId: 1, tags: 1 });

const Favorite = mongoose.model('Favorite', favoriteSchema);