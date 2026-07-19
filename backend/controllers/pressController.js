const PressArticle = require('../models/PressArticle');

exports.getAllArticles = async (req, res, next) => {
  try {
    const { category, page = 1, limit = 10 } = req.query;
    const query = { published: true };
    if (category && category !== 'all') query.category = category;

    const [articles, total] = await Promise.all([
      PressArticle.find(query)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit))
        .select('-__v'),
      PressArticle.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: { articles, pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / limit) } }
    });
  } catch (error) {
    next(error);
  }
};

exports.getFeaturedArticles = async (req, res, next) => {
  try {
    const articles = await PressArticle.find({ published: true, featured: true })
      .sort({ publishedAt: -1 })
      .limit(3)
      .select('-__v');

    res.status(200).json({
      success: true,
      data: { articles }
    });
  } catch (error) {
    next(error);
  }
};

exports.getArticleBySlug = async (req, res, next) => {
  try {
    const article = await PressArticle.findOne({ slug: req.params.slug, published: true }).select('-__v');
    if (!article) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    }
    res.status(200).json({ success: true, data: { article } });
  } catch (error) {
    next(error);
  }
};

exports.createArticle = async (req, res, next) => {
  try {
    const article = await PressArticle.create(req.body);
    res.status(201).json({ success: true, data: { article } });
  } catch (error) {
    next(error);
  }
};

exports.updateArticle = async (req, res, next) => {
  try {
    const article = await PressArticle.findOneAndUpdate(
      { slug: req.params.slug },
      req.body,
      { new: true, runValidators: true }
    );
    if (!article) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    }
    res.status(200).json({ success: true, data: { article } });
  } catch (error) {
    next(error);
  }
};

exports.deleteArticle = async (req, res, next) => {
  try {
    const article = await PressArticle.findOneAndDelete({ slug: req.params.slug });
    if (!article) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Article not found' } });
    }
    res.status(200).json({ success: true, data: null });
  } catch (error) {
    next(error);
  }
};