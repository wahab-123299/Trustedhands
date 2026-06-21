import { useState } from 'react';
import { MessageSquare, Send } from 'lucide-react';

const AdminMessages = () => {
  const [messages, setMessages] = useState([
    { id: 1, from: 'customer@example.com', subject: 'Payment Issue', content: 'I was charged twice for my last job', date: '2024-01-15', read: false },
    { id: 2, from: 'artisan@example.com', subject: 'Verification Request', content: 'Please verify my documents', date: '2024-01-14', read: true },
  ]);

  const [selectedMessage, setSelectedMessage] = useState(null);
  const [reply, setReply] = useState('');

  const handleSendReply = () => {
    if (!reply.trim()) return;
    alert(`Reply sent: ${reply}`);
    setReply('');
    setSelectedMessage(null);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Support Messages</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Message List */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Inbox</h3>
          </div>
          <div className="divide-y divide-gray-200">
            {messages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => setSelectedMessage(msg)}
                className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                  selectedMessage?.id === msg.id ? 'bg-emerald-50' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">{msg.from}</span>
                  {!msg.read && <span className="w-2 h-2 bg-emerald-500 rounded-full" />}
                </div>
                <p className="text-sm text-gray-600 truncate">{msg.subject}</p>
                <p className="text-xs text-gray-400 mt-1">{msg.date}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Message Detail */}
        <div className="lg:col-span-2">
          {selectedMessage ? (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900">{selectedMessage.subject}</h3>
                <p className="text-sm text-gray-500 mt-1">From: {selectedMessage.from}</p>
              </div>
              
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <p className="text-gray-700">{selectedMessage.content}</p>
              </div>

              <div className="space-y-4">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply..."
                  className="w-full p-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[100px]"
                />
                <button
                  onClick={handleSendReply}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
                >
                  <Send size={16} />
                  Send Reply
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center h-64">
              <div className="text-center text-gray-400">
                <MessageSquare size={48} className="mx-auto mb-4" />
                <p>Select a message to view</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminMessages;