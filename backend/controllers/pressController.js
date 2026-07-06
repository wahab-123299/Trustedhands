// backend/controllers/pressController.js
const PressArticle = require('../models/PressArticle');
const { AppError } = require('../utils/errorHandler');

// ==========================================
// PUBLIC ENDPOINTS
// ==========================================

exports.getAllArticles = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, category, search, featured } = req.query;
    
    const query = { isPublished: true };
    
    if (category) query.category = category;
    if (featured === 'true') query.featured = true;
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const articles = await PressArticle.find(query)
      .sort({ publishedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PressArticle.countDocuments(query);

    res.json({
      success: true,
      data: {
        articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getArticleBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;

    const article = await PressArticle.findOne({ 
      slug, 
      isPublished: true 
    });

    if (!article) {
      throw new AppError('NOT_FOUND', 'Article not found');
    }

    res.json({
      success: true,
      data: { article }
    });
  } catch (error) {
    next(error);
  }
};

exports.getFeaturedArticles = async (req, res, next) => {
  try {
    const articles = await PressArticle.find({ 
      isPublished: true, 
      featured: true 
    })
      .sort({ publishedAt: -1 })
      .limit(3);

    res.json({
      success: true,
      data: { articles }
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// ADMIN ENDPOINTS (Protected)
// ==========================================

exports.createArticle = async (req, res, next) => {
  try {
    const article = await PressArticle.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Article created',
      data: { article }
    });
  } catch (error) {
    next(error);
  }
};

exports.updateArticle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await PressArticle.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!article) {
      throw new AppError('NOT_FOUND', 'Article not found');
    }

    res.json({
      success: true,
      message: 'Article updated',
      data: { article }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteArticle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const article = await PressArticle.findByIdAndDelete(id);

    if (!article) {
      throw new AppError('NOT_FOUND', 'Article not found');
    }

    res.json({
      success: true,
      message: 'Article deleted'
    });
  } catch (error) {
    next(error);
  }
};

exports.getAllArticlesAdmin = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const articles = await PressArticle.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await PressArticle.countDocuments();

    res.json({
      success: true,
      data: {
        articles,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    next(error);
  }
};