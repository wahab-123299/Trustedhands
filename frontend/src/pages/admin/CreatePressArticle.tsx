import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '@/services/api';
import { ArrowLeft, Calendar, Clock, User, Share2, Twitter, Facebook, Linkedin } from 'lucide-react';
import { toast } from 'sonner';

interface PressArticle {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  publishedAt: string;
  author: {
    name: string;
    role: string;
  };
  readTime: number;
  tags: string[];
  metaTitle?: string;
  metaDescription?: string;
}

const PressArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [article, setArticle] = useState<PressArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<PressArticle[]>([]);

  useEffect(() => {
    if (slug) {
      fetchArticle();
    }
  }, [slug]);

  const fetchArticle = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/press/${slug}`);
      const articleData = res.data.data?.article || res.data.data;
      setArticle(articleData);

      // Fetch related articles
      if (articleData?.category) {
        const relatedRes = await api.get('/press', { 
          params: { category: articleData.category, limit: 3 } 
        });
        const allRelated = relatedRes.data.data?.articles || relatedRes.data.data || [];
        setRelated(allRelated.filter((a: PressArticle) => a.slug !== slug).slice(0, 3));
      }
    } catch (err) {
      console.error('Failed to load article:', err);
      toast.error('Article not found');
      navigate('/press');
    } finally {
      setLoading(false);
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

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const text = article?.title || 'Check out this article from TrustedHand';

    const shareUrls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    };

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success('Link copied to clipboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!article) return null;

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Back Navigation */}
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <button
          onClick={() => navigate('/press')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition mb-8"
        >
          <ArrowLeft size={20} />
          <span>Back to Press</span>
        </button>
      </div>

      {/* Article Header */}
      <article className="max-w-4xl mx-auto px-4 pb-20">
        <div className="mb-8">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium mb-4 ${getCategoryColor(article.category)}`}>
            {article.category.replace('-', ' ')}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 leading-tight">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-gray-400 text-sm">
            <div className="flex items-center gap-2">
              <User size={16} />
              <span>{article.author.name}</span>
              <span className="text-gray-600">•</span>
              <span>{article.author.role}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar size={16} />
              <span>{formatDate(article.publishedAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>{article.readTime} min read</span>
            </div>
          </div>
        </div>

        {/* Cover Image */}
        <div className="rounded-xl overflow-hidden mb-10">
          <img 
            src={article.coverImage} 
            alt={article.title}
            className="w-full h-64 md:h-96 object-cover"
          />
        </div>

        {/* Share Buttons */}
        <div className="flex items-center gap-3 mb-8 pb-8 border-b border-gray-800">
          <span className="text-gray-400 text-sm">Share:</span>
          <button onClick={() => handleShare('twitter')} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
            <Twitter size={18} className="text-blue-400" />
          </button>
          <button onClick={() => handleShare('facebook')} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
            <Facebook size={18} className="text-blue-600" />
          </button>
          <button onClick={() => handleShare('linkedin')} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
            <Linkedin size={18} className="text-blue-500" />
          </button>
          <button onClick={copyLink} className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition">
            <Share2 size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Article Content */}
        <div 
          className="prose prose-invert prose-lg max-w-none text-gray-300 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Tags */}
        {article.tags && article.tags.length > 0 && (
          <div className="mt-10 pt-8 border-t border-gray-800">
            <div className="flex flex-wrap gap-2">
              {article.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-gray-800 text-gray-400 rounded-full text-sm">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>

      {/* Related Articles */}
      {related.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pb-20">
          <h2 className="text-2xl font-bold text-white mb-6">Related Articles</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {related.map(item => (
              <Link 
                key={item._id}
                to={`/press/${item.slug}`}
                className="group block bg-gray-800 rounded-xl overflow-hidden hover:bg-gray-750 transition"
              >
                <div className="h-40 bg-gray-700 overflow-hidden">
                  <img 
                    src={item.coverImage} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-white mb-2 group-hover:text-emerald-400 transition line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-2">{item.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default PressArticlePage;