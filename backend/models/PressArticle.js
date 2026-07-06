// backend/models/PressArticle.js
const mongoose = require('mongoose');

const pressArticleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  excerpt: {
    type: String,
    required: true,
    maxlength: [500, 'Excerpt cannot exceed 500 characters']
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['news', 'press-release', 'update', 'feature', 'partnership'],
    default: 'news'
  },
  coverImage: {
    type: String,
    default: '/default-press-image.jpg'
  },
  author: {
    name: { type: String, required: true },
    role: { type: String, default: 'TrustedHand Team' },
    avatar: { type: String, default: '/default-avatar.png' }
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  isPublished: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    trim: true
  }],
  readTime: {
    type: Number,
    default: 3 // minutes
  }
}, {
  timestamps: true
});

// Auto-generate slug from title
pressArticleSchema.pre('save', function(next) {
  if (!this.slug || this.isModified('title')) {
    this.slug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }
  next();
});

// Index for search
pressArticleSchema.index({ title: 'text', content: 'text', excerpt: 'text' });

module.exports = mongoose.model('PressArticle', pressArticleSchema);