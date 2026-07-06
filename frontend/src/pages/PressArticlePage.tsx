// frontend/src/pages/PressArticlePage.tsx
import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, Calendar, Clock, User } from 'lucide-react';

interface PressArticle {
  _id: string;
  title: string;
  slug: string;
  content: string;
  coverImage: string;
  category: string;
  publishedAt: string;
  author: {
    name: string;
    role: string;
    avatar: string;
  };
  readTime: number;
  tags: string[];
}

const PressArticlePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = useState<PressArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchArticle();
  }, [slug]);

  const fetchArticle = async () => {
    try {
      const res = await axios.get(`/api/press/${slug}`);
      setArticle(res.data.data.article);
    } catch (err) {
      console.error('Failed to load article:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Article Not Found</h2>
          <Link to="/press" className="text-emerald-400 hover:underline">
            ← Back to Press
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Back Button */}
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <Link 
          to="/press"
          className="inline-flex items-center text-gray-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Press
        </Link>
      </div>

      {/* Article Header */}
      <article className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <span className="inline-block px-4 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-medium mb-4">
            {article.category.replace('-', ' ')}
          </span>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-6 text-gray-400">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>{article.author.name}</span>
              <span className="text-gray-600">({article.author.role})</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>{new Date(article.publishedAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>{article.readTime} min read</span>
            </div>
          </div>
        </div>

        {/* Cover Image */}
        <div className="rounded-2xl overflow-hidden mb-12">
          <img 
            src={article.coverImage} 
            alt={article.title}
            className="w-full h-96 object-cover"
          />
        </div>

        {/* Content */}
        <div 
          className="prose prose-invert prose-lg max-w-none"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />

        {/* Tags */}
        {article.tags.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-800">
            <div className="flex flex-wrap gap-2">
              {article.tags.map(tag => (
                <span 
                  key={tag}
                  className="px-3 py-1 rounded-full bg-gray-800 text-gray-400 text-sm"
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
};

export default PressArticlePage;