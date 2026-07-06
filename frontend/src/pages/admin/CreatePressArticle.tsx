// frontend/src/pages/admin/CreatePressArticle.tsx
import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const CreatePressArticle: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    excerpt: '',
    content: '',
    category: 'news',
    coverImage: '',
    authorName: 'TrustedHand Team',
    authorRole: 'Team',
    tags: '',
    readTime: 3,
    featured: false,
    isPublished: true
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post('/api/press', {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean)
      });
      alert('Article published!');
      navigate('/press');
    } catch (err: any) {
      alert(err.response?.data?.error?.message || 'Failed to publish');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Create Press Article</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-400 mb-2">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({...form, title: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Excerpt (short summary)</label>
            <textarea
              value={form.excerpt}
              onChange={e => setForm({...form, excerpt: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white h-24"
              required
              maxLength={500}
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-2">Content (HTML supported)</label>
            <textarea
              value={form.content}
              onChange={e => setForm({...form, content: e.target.value})}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white h-96 font-mono text-sm"
              required
              placeholder="<p>Write your article here...</p>"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 mb-2">Category</label>
              <select
                value={form.category}
                onChange={e => setForm({...form, category: e.target.value})}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              >
                <option value="news">News</option>
                <option value="press-release">Press Release</option>
                <option value="update">Update</option>
                <option value="feature">Feature</option>
                <option value="partnership">Partnership</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 mb-2">Cover Image URL</label>
              <input
                type="text"
                value={form.coverImage}
                onChange={e => setForm({...form, coverImage: e.target.value})}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
                placeholder="https://..."
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 mb-2">Author Name</label>
              <input
                type="text"
                value={form.authorName}
                onChange={e => setForm({...form, authorName: e.target.value})}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
              />
            </div>

            <div>
              <label className="block text-gray-400 mb-2">Tags (comma separated)</label>
              <input
                type="text"
                value={form.tags}
                onChange={e => setForm({...form, tags: e.target.value})}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white"
                placeholder="nigeria, artisans, technology"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-gray-400">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={e => setForm({...form, featured: e.target.checked})}
                className="w-5 h-5 rounded"
              />
              Featured Article
            </label>

            <label className="flex items-center gap-2 text-gray-400">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={e => setForm({...form, isPublished: e.target.checked})}
                className="w-5 h-5 rounded"
              />
              Publish Immediately
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'Publishing...' : 'Publish Article'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreatePressArticle;