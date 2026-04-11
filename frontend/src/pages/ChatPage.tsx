import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Send, Paperclip, Phone, Video, MoreVertical, ArrowLeft, WifiOff, Info, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useSocket } from '@/contexts/SocketContext';
import { chatApi } from '@/services/api';
import { Message, Conversation } from '@/types';
import { formatRelativeTime, getInitials } from '@/lib/utils';
import { useMemo } from 'react';
import { toast } from 'sonner';

// ==========================================
// COMPONENT
// ==========================================

const ChatPage = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const {  
    isConnected, 
    sendMessage, 
    joinConversation, 
    leaveConversation,
    messages: socketMessages,
    setConversationMessages,
    sendTyping,
    markConversationRead,
    typingUsers,
    onlineUsers,
    getOnlineStatus
  } = useSocket();
  
  // Local state
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState<Date | undefined>();
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isInitialLoad = useRef(true);
  const hasMarkedRead = useRef(false);

  // Get messages for this conversation
  const messages = conversationId ? socketMessages.get(conversationId) || [] : [];

  // Get typing status for other user
  const otherUserTyping = useMemo(() => {
    if (!conversationId || !user) return false;
    const typingList = typingUsers.get(conversationId) || [];
    return typingList.some(t => t.userId !== user._id);
  }, [typingUsers, conversationId, user]);

  // ==========================================
  // INITIALIZATION
  // ==========================================

  // Load conversation and join socket room
  useEffect(() => {
    if (!conversationId) {
      navigate('/messages');
      return;
    }

    const init = async () => {
      try {
        setIsLoading(true);
        isInitialLoad.current = true;
        hasMarkedRead.current = false;

        // Fetch conversation details
        const convRes = await chatApi.getConversations();
        const conversations = convRes.data.data.conversations;
        const currentConv = conversations.find((c: Conversation) => c._id === conversationId);
        
        if (!currentConv) {
          toast.error('Conversation not found');
          navigate('/messages');
          return;
        }
        
        setConversation(currentConv);

        // Fetch initial messages via API (for history)
        const msgRes = await chatApi.getMessages(conversationId, { limit: 50 });
        const initialMessages = msgRes.data.data.messages || [];
        
        // Reverse to show oldest first
        setConversationMessages(conversationId, initialMessages.reverse());
        setHasMoreMessages(initialMessages.length === 50);

        // Join socket room for real-time updates
        setIsJoining(true);
        await joinConversation(conversationId);
        setIsJoining(false);

        // Get other user's online status
        const otherParticipant = currentConv.participants.find((p: any) => p._id !== user?._id);
        if (otherParticipant) {
          const status = await getOnlineStatus(otherParticipant._id);
          if (!status.isOnline) {
            setOtherUserLastSeen(status.lastSeen);
          }
        }
      } catch (error: any) {
        console.error('Chat initialization error:', error);
        toast.error(error.message || 'Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // Cleanup
    return () => {
      if (conversationId) {
        leaveConversation(conversationId);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId, navigate, user?._id, joinConversation, leaveConversation, setConversationMessages, getOnlineStatus]);

  // ==========================================
  // MESSAGE HANDLING
  // ==========================================

  // Mark messages as read when viewing
  useEffect(() => {
    if (!conversationId || !user || hasMarkedRead.current || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (m: Message) => {
        const receiverId = typeof m.receiverId === 'string' ? m.receiverId : m.receiverId._id;
        return receiverId === user._id && !m.isRead;
      }
    );

    if (unreadMessages.length > 0) {
      // Mark conversation as read
      markConversationRead(conversationId);
      hasMarkedRead.current = true;
    }
  }, [messages, conversationId, user, markConversationRead]);

  // Auto-scroll to bottom on initial load and new messages
  useEffect(() => {
    if (isInitialLoad.current && messages.length > 0) {
      scrollToBottom(false);
      isInitialLoad.current = false;
    }
  }, [messages.length]);

  // Scroll when typing indicator appears/disappears
  useEffect(() => {
    if (otherUserTyping) {
      scrollToBottom(true);
    }
  }, [otherUserTyping]);

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: smooth ? 'smooth' : 'auto',
      block: 'end'
    });
  };

  // Load more messages (pagination)
  const loadMoreMessages = useCallback(async () => {
    if (!conversationId || isLoadingMore || !hasMoreMessages) return;

    try {
      setIsLoadingMore(true);
      const oldestMessage = messages[0];
      const before = oldestMessage?.createdAt;

      const msgRes = await chatApi.getMessages(conversationId, { 
        limit: 30, 
        before 
      });
      const newMessages = msgRes.data.data.messages || [];

      if (newMessages.length === 0) {
        setHasMoreMessages(false);
      } else {
        // Prepend to existing messages
        const currentMessages = socketMessages.get(conversationId) || [];
        setConversationMessages(conversationId, [...newMessages.reverse(), ...currentMessages]);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, isLoadingMore, hasMoreMessages, messages, socketMessages, setConversationMessages]);

  // ==========================================
  // INPUT HANDLING
  // ==========================================

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    
    // Send typing indicator
    if (conversationId && !typingTimeoutRef.current) {
      sendTyping(conversationId, true);
    }
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 2 seconds
    typingTimeoutRef.current = setTimeout(() => {
      if (conversationId) {
        sendTyping(conversationId, false);
      }
      typingTimeoutRef.current = undefined;
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !conversationId) {
      return;
    }

    if (!isConnected) {
      toast.error('Not connected to chat server. Please wait...');
      return;
    }

    const content = newMessage.trim();
    setNewMessage('');
    
    // Clear typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = undefined;
    }
    sendTyping(conversationId, false);

    try {
      await sendMessage({
        conversationId,
        content,
        clientMessageId: `temp_${Date.now()}`,
        receiverId: getOtherParticipant()?._id!,  // Add ! to assert it's not undefined
      });

      // Scroll to bottom after sending
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error: any) {
      toast.error(error.message || 'Failed to send message');
      // Restore message to input for retry
      setNewMessage(content);
    }
    
    inputRef.current?.focus();
  };

  const handleAttachment = () => {
    toast.info('File upload coming soon');
  };

  const handleViewProfile = () => {
    const otherParticipant = getOtherParticipant();
    if (otherParticipant) {
      const profileRoute = otherParticipant.role === 'artisan' 
        ? `/artisans/${otherParticipant._id}`
        : `/profile/${otherParticipant._id}`;
      navigate(profileRoute);
    }
  };

  // ==========================================
  // HELPERS
  // ==========================================

  const getOtherParticipant = useCallback(() => {
    if (!conversation || !user) return null;
    return conversation.participants.find((p: any) => p._id !== user._id);
  }, [conversation, user]);

  const getMessageStatusIcon = (message: Message) => {
    if (!message._id?.toString().match(/^[0-9a-fA-F]{24}$/)) {
      // Temporary message
      return <span className="text-xs text-gray-400">...</span>;
    }
    
    if (message.isRead) {
      return <CheckCheck className="w-3 h-3 text-blue-500" />;
    }
    
    if (message.deliveryStatus === 'delivered') {
      return <CheckCheck className="w-3 h-3 text-gray-400" />;
    }
    
    return <Check className="w-3 h-3 text-gray-400" />;
  };

  // Group messages by date
  const groupMessagesByDate = useCallback((messages: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentGroup: { date: string; messages: Message[] } | null = null;

    messages.forEach((message) => {
      const messageDate = new Date(message.createdAt);
      const dateKey = messageDate.toLocaleDateString('en-NG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      
      if (!currentGroup || currentGroup.date !== dateKey) {
        currentGroup = { date: dateKey, messages: [] };
        groups.push(currentGroup);
      }
      
      currentGroup.messages.push(message);
    });

    return groups;
  }, []);

  const messageGroups = groupMessagesByDate(messages);
  const otherParticipant = getOtherParticipant();
  const isOtherUserOnline = otherParticipant ? onlineUsers.has(otherParticipant._id) : false;

  // ==========================================
  // RENDER
  // ==========================================

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-500">Loading conversation...</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Conversation not found</p>
          <Button onClick={() => navigate('/messages')}>
            Back to Messages
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 shadow-sm z-10">
        <Button variant="ghost" size="icon" onClick={() => navigate('/messages')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        {otherParticipant && (
          <>
            <div 
              className="relative cursor-pointer"
              onClick={handleViewProfile}
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={otherParticipant.profileImage} alt={otherParticipant.fullName} />
                <AvatarFallback className="bg-emerald-100 text-emerald-700">
                  {getInitials(otherParticipant.fullName)}
                </AvatarFallback>
              </Avatar>
              {isOtherUserOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full" />
              )}
            </div>
            
            <div 
              className="flex-1 min-w-0 cursor-pointer"
              onClick={handleViewProfile}
            >
              <h3 className="font-semibold truncate">{otherParticipant.fullName}</h3>
              <p className="text-sm text-gray-500">
                {otherUserTyping ? (
                  <span className="text-emerald-600 italic animate-pulse">typing...</span>
                ) : isOtherUserOnline ? (
                  <span className="text-green-600">Online</span>
                ) : otherUserLastSeen ? (
                  `Last seen ${formatRelativeTime(otherUserLastSeen)}`
                ) : otherParticipant.lastLogin ? (
                  `Last seen ${formatRelativeTime(otherParticipant.lastLogin)}`
                ) : (
                  'Offline'
                )}
              </p>
            </div>
          </>
        )}

        <div className="flex items-center gap-1">
          {!isConnected && (
            <div className="flex items-center gap-1 text-amber-500 mr-2" title="Disconnected">
              <WifiOff className="w-4 h-4" />
              <span className="text-xs hidden sm:inline">Reconnecting...</span>
            </div>
          )}
          
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Phone className="w-5 h-5" />
          </Button>
          
          <Button variant="ghost" size="icon" className="hidden sm:flex">
            <Video className="w-5 h-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleViewProfile}>
                <Info className="w-4 h-4 mr-2" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => markConversationRead(conversationId!)}>
                Mark as Read
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollContainerRef}>
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Load more button */}
          {hasMoreMessages && messages.length > 0 && (
            <div className="flex justify-center py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMoreMessages}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading...' : 'Load more messages'}
              </Button>
            </div>
          )}

          {messageGroups.map((group) => (
            <div key={group.date} className="space-y-3">
              {/* Date separator */}
              <div className="flex justify-center sticky top-0 z-10">
                <span className="text-xs text-gray-500 bg-gray-200/80 backdrop-blur px-3 py-1 rounded-full">
                  {group.date}
                </span>
              </div>

              {group.messages.map((message, index) => {
                const isSender = (typeof message.senderId === 'string' ? message.senderId : message.senderId._id) === user?._id;
                const prevMessage = index > 0 ? group.messages[index - 1] : null;
                const showAvatar = !prevMessage || 
                  (typeof prevMessage.senderId === 'string' ? prevMessage.senderId : prevMessage.senderId._id) !== 
                  (typeof message.senderId === 'string' ? message.senderId : message.senderId._id);
                const isTemp = !message._id?.toString().match(/^[0-9a-fA-F]{24}$/);

                return (
                  <div
                    key={message._id || `temp-${index}`}
                    className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[85%] sm:max-w-[70%] ${isSender ? 'flex-row-reverse' : ''}`}>
                      {!isSender && showAvatar && (
                        <Avatar className="w-8 h-8 mt-1 flex-shrink-0">
                          <AvatarImage 
                            src={typeof message.senderId === 'string' ? undefined : message.senderId.profileImage} 
                            alt={typeof message.senderId === 'string' ? 'User' : message.senderId.fullName} 
                          />
                          <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                            {getInitials(typeof message.senderId === 'string' ? 'U' : message.senderId.fullName)}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {!isSender && !showAvatar && <div className="w-8 flex-shrink-0" />}
                      
                      <div className="flex flex-col">
                        <div
                          className={`px-4 py-2.5 rounded-2xl relative ${
                            isSender
                              ? 'bg-emerald-500 text-white rounded-br-none'
                              : 'bg-white border border-gray-200 rounded-bl-none shadow-sm'
                          } ${isTemp ? 'opacity-60' : ''} ${message.isEdited ? 'italic' : ''}`}
                        >
                          <p className="break-words text-sm sm:text-base leading-relaxed">
                            {message.content}
                          </p>
                          
                          {/* Attachments */}
                          {message.attachments && message.attachments.length > 0 && (
                            <div className="mt-2 space-y-2">
                              {message.attachments.map((att, i) => (
                                <div 
                                  key={i} 
                                  className={`p-2 rounded-lg flex items-center gap-2 ${
                                    isSender ? 'bg-emerald-600' : 'bg-gray-100'
                                  }`}
                                >
                                  <Paperclip className="w-4 h-4" />
                                  <span className="text-sm truncate max-w-[150px]">{att.name}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Edited indicator */}
                          {message.isEdited && (
                            <span className={`text-xs ${isSender ? 'text-emerald-100' : 'text-gray-400'} mt-1 block`}>
                              edited
                            </span>
                          )}
                        </div>
                        
                        {/* Message meta */}
                        <div className={`flex items-center gap-1 mt-1 ${isSender ? 'justify-end' : ''}`}>
                          <span className={`text-xs ${isSender ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {formatRelativeTime(message.createdAt)}
                          </span>
                          {isSender && (
                            <span className="ml-1">
                              {getMessageStatusIcon(message)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {/* Typing indicator */}
          {otherUserTyping && (
            <div className="flex justify-start">
              <div className="flex gap-2 max-w-[70%]">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={otherParticipant?.profileImage} />
                  <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs">
                    {getInitials(otherParticipant?.fullName || '')}
                  </AvatarFallback>
                </Avatar>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <form onSubmit={handleSendMessage} className="bg-white border-t border-gray-200 p-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Button 
            type="button" 
            variant="ghost" 
            size="icon"
            onClick={handleAttachment}
            disabled={!isConnected}
          >
            <Paperclip className="w-5 h-5" />
          </Button>
          <Input
            ref={inputRef}
            type="text"
            placeholder={isConnected ? "Type a message..." : "Reconnecting..."}
            value={newMessage}
            onChange={handleInputChange}
            disabled={!isConnected || isJoining}
            className="flex-1"
            maxLength={2000}
          />
          <Button 
            type="submit" 
            className="bg-emerald-500 hover:bg-emerald-600"
            disabled={!newMessage.trim() || !isConnected || isJoining}
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
        <div className="text-xs text-gray-400 text-center mt-1">
          {newMessage.length}/2000
        </div>
      </form>
    </div>
  );
};

export default ChatPage;