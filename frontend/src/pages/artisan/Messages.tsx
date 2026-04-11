import React, { useEffect, useState} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Search, 
  MoreVertical, 
  Trash2, 
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { chatApi,  } from '@/services/api';
import { Conversation } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface ConversationWithDetails extends Conversation {
  otherParticipant?: {
    _id: string;
    fullName: string;
    profileImage?: string;
    isOnline?: boolean;
    role?: string;
  };
  jobDetails?: {
    title: string;
    status: string;
  };
}

const Messages: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { unreadCount, conversationUnread } = useSocket();
  
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<ConversationWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const artisanId = searchParams.get('artisanId');

  useEffect(() => {
    if (artisanId) {
      createConversationWithArtisan();
    } else {
      fetchConversations();
    }
  }, [artisanId]);

  const createConversationWithArtisan = async () => {
    try {
      setIsLoading(true);
      const response = await chatApi.createConversation({ participantId: artisanId! });
      navigate(`/chat/${response.data.data.conversation._id}`);
    } catch (error: any) {
      toast.error('Failed to start conversation');
      navigate('/messages');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchConversations = async () => {
    try {
      setIsLoading(true);
      const response = await chatApi.getConversations();
      const convs = response.data.data.conversations || [];
      
      // Enrich with other participant details
      const enrichedConvs = convs.map((conv: Conversation) => {
        const otherParticipant = conv.participants.find(
          (p: any) => p._id !== user?._id
        );
        
        return {
          ...conv,
          otherParticipant: otherParticipant ? {
            _id: otherParticipant._id,
            fullName: otherParticipant.fullName,
            profileImage: otherParticipant.profileImage,
            isOnline: otherParticipant.isOnline,
            role: otherParticipant.role,
          } : undefined,
          jobDetails: conv.jobId && typeof conv.jobId === 'object' ? {
            title: conv.jobId.title,
            status: conv.jobId.status,
          } : undefined,
          unreadCount: conversationUnread.get(conv._id) || 0,
        };
      });
      
      setConversations(enrichedConvs);
    } catch (error: any) {
      toast.error('Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedConversation) return;
    
    try {
      setIsDeleting(true);
      await chatApi.deleteConversation(selectedConversation._id);
      toast.success('Conversation deleted');
      setConversations(prev => prev.filter(c => c._id !== selectedConversation._id));
      setDeleteDialogOpen(false);
    } catch (error: any) {
      toast.error('Failed to delete conversation');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      conv.otherParticipant?.fullName.toLowerCase().includes(searchLower) ||
      conv.lastMessage?.content.toLowerCase().includes(searchLower) ||
      conv.jobDetails?.title.toLowerCase().includes(searchLower)
    );
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
            <p className="text-gray-600">
              {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'No new messages'}
            </p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
            <p className="text-gray-500 max-w-sm mb-4">
              {searchTerm 
                ? 'No conversations match your search'
                : 'Start chatting with artisans or customers about your jobs'}
            </p>
            <Button 
              onClick={() => navigate(user?.role === 'artisan' ? '/artisan/jobs' : '/artisans')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {user?.role === 'artisan' ? 'Browse Jobs' : 'Find Artisans'}
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredConversations.map((conversation) => {
              const unread = conversationUnread.get(conversation._id) || 0;
              const isLastMessageFromMe = conversation.lastMessage?.senderId === user?._id;
              
              return (
                <div
                  key={conversation._id}
                  className={`p-4 hover:bg-white cursor-pointer transition-colors ${
                    unread > 0 ? 'bg-emerald-50/50' : ''
                  }`}
                  onClick={() => navigate(`/chat/${conversation._id}`)}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="relative">
                      <Avatar className="w-12 h-12">
                        <AvatarImage 
                          src={conversation.otherParticipant?.profileImage} 
                          alt={conversation.otherParticipant?.fullName}
                        />
                        <AvatarFallback className="bg-emerald-100 text-emerald-700">
                          {getInitials(conversation.otherParticipant?.fullName || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      {conversation.otherParticipant?.isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {conversation.otherParticipant?.fullName}
                        </h3>
                        <span className="text-xs text-gray-500">
                          {conversation.lastMessage?.createdAt && 
                            formatDistanceToNow(conversation.lastMessage.createdAt)
                          }
                        </span>
                      </div>

                      {conversation.jobDetails && (
                        <Badge variant="outline" className="mb-2 text-xs">
                          {conversation.jobDetails.title}
                        </Badge>
                      )}

                      <div className="flex items-center gap-2">
                        {isLastMessageFromMe && (
                          <CheckCheck className={`w-4 h-4 ${
                            conversation.lastMessage?.isRead ? 'text-blue-500' : 'text-gray-400'
                          }`} />
                        )}
                        <p className={`text-sm truncate flex-1 ${
                          unread > 0 ? 'font-medium text-gray-900' : 'text-gray-600'
                        }`}>
                          {conversation.lastMessage?.content || 'No messages yet'}
                        </p>
                        {unread > 0 && (
                          <Badge className="bg-emerald-500 text-white px-2 py-0.5 text-xs">
                            {unread}
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConversation(conversation);
                          setDeleteDialogOpen(true);
                        }}>
                          <Trash2 className="w-4 h-4 mr-2 text-red-500" />
                          Delete Conversation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Messages;