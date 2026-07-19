const mongoose = require('mongoose');

const pressArticleSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  excerpt: { type: String, required: true, maxlength: 500 },
  content: { type: String, required: true },
  coverImage: { type: String, required: true },
  category: {
    type: String,
    enum: ['news', 'press-release', 'update', 'feature', 'partnership'],
    default: 'news'
  },
  author: {
    name: { type: String, required: true },
    role: { type: String, default: 'TrustedHand Team' }
  },
  readTime: { type: Number, default: 5 },
  featured: { type: Boolean, default: false },
  published: { type: Boolean, default: true },
  publishedAt: { type: Date, default: Date.now },
  tags: [{ type: String }],
  metaTitle: { type: String },
  metaDescription: { type: String }
}, { timestamps: true });

// Index for faster queries
pressArticleSchema.index({ slug: 1 });
pressArticleSchema.index({ category: 1, publishedAt: -1 });
pressArticleSchema.index({ featured: 1, publishedAt: -1 });

module.exports = mongoose.model('PressArticle', pressArticleSchema);