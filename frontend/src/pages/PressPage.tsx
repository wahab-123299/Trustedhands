import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/services/api'; // FIXED: Use centralized api instead of raw axios

interface PressArticle {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: string;
  publishedAt: string;
  author: {
    name: string;
    role: string;
  };
  readTime: number;
  featured: boolean;
}

const PressPage: React.FC = () => {
  const [articles, setArticles] = useState<PressArticle[]>([]);
  const [featured, setFeatured] = useState<PressArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');

  useEffect(() => {
    fetchArticles();
    fetchFeatured();
  }, [category]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      const params = category !== 'all' ? { category } : {};
      // FIXED: Use api instance (absolute URL, with credentials)
      const res = await api.get('/press', { params });
      setArticles(res.data.data?.articles || res.data.data || []);
    } catch (err) {
      console.error('Failed to load articles:', err);
      setArticles([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeatured = async () => {
    try {
      // FIXED: Use api instance
      const res = await api.get('/press/featured');
      setFeatured(res.data.data?.articles || res.data.data || []);
    } catch (err) {
      console.error('Failed to load featured:', err);
      setFeatured([]);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      news: 'bg-blue-100 text-blue-800',
      'press-release': 'bg-green-100 text-green-800',
      update: 'bg-yellow-100 text-yellow-800',
      feature: 'bg-purple-100 text-purple-800',
      partnership: 'bg-pink-100 text-pink-800'
    };
    return colors[cat] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-b from-gray-800 to-gray-900 py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-white mb-4">Press & Media</h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Latest news, updates, and resources about TrustedHand.
          </p>
        </div>
      </div>

      {/* Featured Articles */}
      {featured.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-white mb-6">Featured</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {featured.map(article => (
              <Link 
                key={article._id}
                to={`/press/${article.slug}`}
                className="group block bg-gray-800 rounded-xl overflow-hidden hover:bg-gray-750 transition"
              >
                <div className="h-48 bg-gray-700 overflow-hidden">
                  <img 
                    src={article.coverImage} 
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                </div>
                <div className="p-6">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-3 ${getCategoryColor(article.category)}`}>
                    {article.category.replace('-', ' ')}
                  </span>
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-emerald-400 transition">
                    {article.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-2">{article.excerpt}</p>
                  <div className="mt-4 flex items-center text-sm text-gray-500">
                    <span>{formatDate(article.publishedAt)}</span>
                    <span className="mx-2">•</span>
                    <span>{article.readTime} min read</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter */}
      <div className="max-w-6xl mx-auto px-4 pb-6">
        <div className="flex flex-wrap gap-2">
          {['all', 'news', 'press-release', 'update', 'feature', 'partnership'].map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                category === cat
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {cat === 'all' ? 'All' : cat.replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Articles Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {articles.map(article => (
            <Link 
              key={article._id}
              to={`/press/${article.slug}`}
              className="group block bg-gray-800 rounded-xl overflow-hidden hover:bg-gray-750 transition border border-gray-700"
            >
              <div className="h-56 bg-gray-700 overflow-hidden">
                <img 
                  src={article.coverImage} 
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
              <div className="p-6">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor(article.category)}`}>
                    {article.category.replace('-', ' ')}
                  </span>
                  <span className="text-gray-500 text-xs">{article.readTime} min read</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-3 group-hover:text-emerald-400 transition">
                  {article.title}
                </h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-3">{article.excerpt}</p>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-bold">
                    {article.author.name[0]}
                  </div>
                  <div>
                    <p className="text-sm text-white">{article.author.name}</p>
                    <p className="text-xs text-gray-500">{formatDate(article.publishedAt)}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {articles.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">No articles yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PressPage;