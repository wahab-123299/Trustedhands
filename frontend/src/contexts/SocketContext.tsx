import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  ReactNode, 
  useCallback,
  useRef,
  useMemo
} from 'react';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';
import { Message } from '@/types';

// ==========================================
// TYPE DEFINITIONS
// ==========================================

interface TypingUser {
  userId: string;
  userName: string;
  conversationId: string;
  timestamp: number;
}

interface SocketContextType {
  // Connection state
  isConnected: boolean;
  connectionError: string | null;
  
  // Presence
  onlineUsers: Set<string>;
  typingUsers: Map<string, TypingUser[]>;
  
  // Actions
  joinConversation: (conversationId: string) => Promise<void>;
  leaveConversation: (conversationId: string) => void;
  sendMessage: (data: SendMessageData) => Promise<void>;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  markAsRead: (messageId: string, conversationId: string) => void;
  markConversationRead: (conversationId: string) => void;
  getOnlineStatus: (userId: string) => Promise<{ isOnline: boolean; lastSeen?: Date }>;
  
  // Data
  unreadCount: number;
  conversationUnread: Map<string, number>;
  messages: Map<string, Message[]>;
  
  // Message management
  setConversationMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (conversationId: string, message: Message) => void;
  updateMessage: (conversationId: string, messageId: string, updates: Partial<Message>) => void;
  updateMessageStatus: (messageId: string, status: string, data?: any) => void;
}

interface SendMessageData {
  conversationId: string;
  receiverId: string;
  content: string;
  attachments?: any[];
  replyTo?: string;
  clientMessageId?: string;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

// ==========================================
// SOCKET PROVIDER
// ==========================================

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get socket from AuthContext instead of creating it here
  const { socket, user, isAuthenticated } = useAuth();
  
  // State
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser[]>>(new Map());
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversationUnread, setConversationUnread] = useState<Map<string, number>>(new Map());
  const [messages, setMessages] = useState<Map<string, Message[]>>(new Map());
  
  // Refs
  const joinedConversations = useRef<Set<string>>(new Set());
  const pendingMessages = useRef<Map<string, (value: void | PromiseLike<void>) => void>>(new Map());
  const typingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // ==========================================
  // CONNECTION STATE TRACKING
  // ==========================================

  useEffect(() => {
    if (!socket) {
      setIsConnected(false);
      setConnectionError(null);
      return;
    }

    const handleConnect = () => {
      console.log('🔌 SocketContext: Socket connected');
      setIsConnected(true);
      setConnectionError(null);
      
      // Re-join any previously joined conversations
      joinedConversations.current.forEach(conversationId => {
        socket.emit('join_conversation', { conversationId });
      });
    };

    const handleDisconnect = (reason: string) => {
      console.log('❌ SocketContext: Socket disconnected:', reason);
      setIsConnected(false);
    };

    const handleConnectError = (error: Error) => {
      console.error('SocketContext: Connection error:', error.message);
      setIsConnected(false);
      setConnectionError(error.message);
      
      if (!error.message?.includes('AUTH_TOKEN_REQUIRED')) {
        toast.error('Chat connection failed');
      }
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    // Set initial state
    setIsConnected(socket.connected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket]);

  // ==========================================
  // SOCKET EVENT HANDLERS
  // ==========================================

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    // Message events
    const handleReceiveMessage = (data: { message: Message; conversationId: string; clientMessageId?: string }) => {
      const { message, conversationId, clientMessageId } = data;
      
      // Resolve pending promise if exists
      if (clientMessageId && pendingMessages.current.has(clientMessageId)) {
        const resolve = pendingMessages.current.get(clientMessageId)!;
        resolve();
        pendingMessages.current.delete(clientMessageId);
      }
      
      addMessageInternal(conversationId, message);
      
      // Show notification if not from current user
      const senderId = typeof message.senderId === 'string' ? message.senderId : message.senderId._id;
      if (senderId !== user?._id) {
        const senderName = typeof message.senderId === 'string' ? 'Someone' : message.senderId.fullName;
        
        const currentPath = window.location.pathname;
        if (!currentPath.includes(`/chat/${conversationId}`)) {
          toast.info(`New message from ${senderName}`, {
            description: message.content?.substring(0, 50) + (message.content?.length > 50 ? '...' : ''),
            action: {
              label: 'View',
              onClick: () => window.location.href = `/chat/${conversationId}`,
            },
          });
        }
      }
    };

    const handleMessageSent = (data: { message: Message; conversationId: string; clientMessageId?: string }) => {
      const { message, conversationId, clientMessageId } = data;
      
      if (clientMessageId && pendingMessages.current.has(clientMessageId)) {
        const resolve = pendingMessages.current.get(clientMessageId)!;
        resolve();
        pendingMessages.current.delete(clientMessageId);
      }
      
      setMessages(prev => {
        const newMessages = new Map(prev);
        const conversationMessages = newMessages.get(conversationId) || [];
        
        const index = conversationMessages.findIndex(m => 
          m._id === clientMessageId || 
          m._id?.toString().startsWith('temp_') ||
          (m.content === message.content && m.senderId === message.senderId && !m._id?.toString().match(/^[0-9a-fA-F]{24}$/))
        );
        
        if (index >= 0) {
          conversationMessages[index] = { ...message, deliveryStatus: 'sent' };
        } else if (!conversationMessages.find(m => m._id === message._id)) {
          conversationMessages.push(message);
        }
        
        newMessages.set(conversationId, conversationMessages);
        return newMessages;
      });
    };

    const handleMessageStatus = (data: { messageId: string; conversationId: string; status: string; readAt?: Date; deliveredAt?: Date }) => {
      setMessages(prev => {
        const newMessages = new Map(prev);
        const conversationMessages = newMessages.get(data.conversationId);
        
        if (conversationMessages) {
          const message = conversationMessages.find(m => m._id === data.messageId);
          if (message) {
            message.deliveryStatus = data.status as 'sent' | 'delivered' | 'read';
            if (data.status === 'read') {
              message.isRead = true;
              message.readAt = data.readAt?.toString() || new Date().toISOString();
            } else if (data.status === 'delivered') {
              message.deliveredAt = data.deliveredAt?.toString() || new Date().toISOString();
            }
          }
        }
        
        return newMessages;
      });
    };

    const handleMessagesRead = (data: { conversationId: string; readBy: string; readAt: Date; count: number }) => {
      setMessages(prev => {
        const newMessages = new Map(prev);
        const conversationMessages = newMessages.get(data.conversationId);
        
        if (conversationMessages) {
          conversationMessages.forEach(msg => {
            const senderId = typeof msg.senderId === 'string' ? msg.senderId : msg.senderId._id;
            if (senderId === user?._id && !msg.isRead) {
              msg.isRead = true;
              msg.readAt = data.readAt.toString(); 
              msg.deliveryStatus = 'read';
            }
          });
        }
        
        return newMessages;
      });
    };

    const handleUserTyping = (data: { userId: string; userName: string; isTyping: boolean; conversationId: string }) => {
      setTypingUsers(prev => {
        const newTyping = new Map(prev);
        const conversationTyping = newTyping.get(data.conversationId) || [];
        
        if (data.isTyping) {
          if (!conversationTyping.find(t => t.userId === data.userId)) {
            conversationTyping.push({
              userId: data.userId,
              userName: data.userName,
              conversationId: data.conversationId,
              timestamp: Date.now(),
            });
          }
        } else {
          const index = conversationTyping.findIndex(t => t.userId === data.userId);
          if (index >= 0) conversationTyping.splice(index, 1);
        }
        
        newTyping.set(data.conversationId, conversationTyping);
        return newTyping;
      });
      
      if (data.isTyping) {
        const timeoutKey = `${data.conversationId}-${data.userId}`;
        if (typingTimeouts.current.has(timeoutKey)) {
          clearTimeout(typingTimeouts.current.get(timeoutKey)!);
        }
        
        const timeout = setTimeout(() => {
          setTypingUsers(prev => {
            const newTyping = new Map(prev);
            const conversationTyping = newTyping.get(data.conversationId) || [];
            const index = conversationTyping.findIndex(t => t.userId === data.userId);
            if (index >= 0) {
              conversationTyping.splice(index, 1);
              newTyping.set(data.conversationId, conversationTyping);
            }
            return newTyping;
          });
        }, 5000);
        
        typingTimeouts.current.set(timeoutKey, timeout);
      }
    };

    const handleUnreadCount = (data: { count: number; conversations?: Record<string, number> }) => {
      setUnreadCount(data.count);
      if (data.conversations) {
        setConversationUnread(new Map(Object.entries(data.conversations)));
      }
    };

    const handleUserOffline = (data: { userId: string; lastSeen?: Date }) => {
      setOnlineUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(data.userId);
        return newSet;
      });
    };

    const handleUserJoined = (data: { userId: string; conversationId: string }) => {
      setOnlineUsers(prev => new Set(prev).add(data.userId));
    };

    const handleNotification = (data: any) => {
      switch (data.type) {
        case 'new_message':
          break;
        case 'payment_received':
          toast.success('Payment Received', { description: data.message });
          break;
        case 'payment_released':
          toast.success('Payment Released', { description: data.message });
          break;
        case 'job_accepted':
          toast.success('Job Accepted', { description: data.message });
          break;
        default:
          toast.info(data.message || 'New notification');
      }
    };

    const handleError = (data: { code: string; message: string }) => {
      console.error('Socket error:', data);
      if (!data.message?.includes('AUTH_TOKEN_REQUIRED')) {
        toast.error(data.message || 'An error occurred');
      }
    };

    // Register listeners
    socket.on('receive_message', handleReceiveMessage);
    socket.on('message_sent', handleMessageSent);
    socket.on('message_status', handleMessageStatus);
    socket.on('messages_read', handleMessagesRead);
    socket.on('user_typing', handleUserTyping);
    socket.on('unread_count', handleUnreadCount);
    socket.on('user_offline', handleUserOffline);
    socket.on('user_joined', handleUserJoined);
    socket.on('notification', handleNotification);
    socket.on('error', handleError);

    return () => {
      // Cleanup timeouts
      typingTimeouts.current.forEach(timeout => clearTimeout(timeout));
      typingTimeouts.current.clear();
      
      // Remove listeners
      socket.off('receive_message', handleReceiveMessage);
      socket.off('message_sent', handleMessageSent);
      socket.off('message_status', handleMessageStatus);
      socket.off('messages_read', handleMessagesRead);
      socket.off('user_typing', handleUserTyping);
      socket.off('unread_count', handleUnreadCount);
      socket.off('user_offline', handleUserOffline);
      socket.off('user_joined', handleUserJoined);
      socket.off('notification', handleNotification);
      socket.off('error', handleError);
    };
  }, [socket, isAuthenticated, user?._id]);

  // ==========================================
  // INTERNAL HELPERS
  // ==========================================

  const addMessageInternal = useCallback((conversationId: string, message: Message) => {
    setMessages(prev => {
      const newMessages = new Map(prev);
      const conversationMessages = newMessages.get(conversationId) || [];
      
      if (!conversationMessages.find(m => m._id === message._id)) {
        const insertIndex = conversationMessages.findIndex(
          m => new Date(m.createdAt) > new Date(message.createdAt)
        );
        
        if (insertIndex === -1) {
          conversationMessages.push(message);
        } else {
          conversationMessages.splice(insertIndex, 0, message);
        }
        
        newMessages.set(conversationId, conversationMessages);
      }
      
      return newMessages;
    });
  }, []);

  // ==========================================
  // PUBLIC ACTIONS
  // ==========================================

  const joinConversation = useCallback(async (conversationId: string): Promise<void> => {
    if (!socket || !isConnected) {
      throw new Error('Socket not connected');
    }

    return new Promise((resolve, reject) => {
      if (joinedConversations.current.has(conversationId)) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Join conversation timeout'));
      }, 10000);

      const handleJoined = (data: { conversationId: string; messages: Message[] }) => {
        if (data.conversationId === conversationId) {
          clearTimeout(timeout);
          socket.off('conversation_joined', handleJoined);
          joinedConversations.current.add(conversationId);
          setConversationMessages(conversationId, data.messages);
          resolve();
        }
      };

      socket.on('conversation_joined', handleJoined);
      socket.emit('join_conversation', { conversationId });
    });
  }, [socket, isConnected]);

  const leaveConversation = useCallback((conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('leave_conversation', { conversationId });
      joinedConversations.current.delete(conversationId);
    }
  }, [socket, isConnected]);

  const sendMessage = useCallback(async (data: SendMessageData): Promise<void> => {
    if (!socket || !isConnected) {
      toast.error('Not connected to chat server');
      throw new Error('Socket not connected');
    }

    const clientMessageId = data.clientMessageId || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const optimisticMessage: Message = {
      _id: clientMessageId,
      conversationId: data.conversationId,
      receiverId: data.receiverId,
      senderId: user!,
      content: data.content,
      attachments: data.attachments || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isRead: false,
      isDeleted: false,
      deliveryStatus: "sent",
    };

    addMessageInternal(data.conversationId, optimisticMessage);

    return new Promise((resolve, reject) => {
      pendingMessages.current.set(clientMessageId, resolve);

      const timeout = setTimeout(() => {
        if (pendingMessages.current.has(clientMessageId)) {
          pendingMessages.current.delete(clientMessageId);
          updateMessage(data.conversationId, clientMessageId, { deliveryStatus: 'failed' });
          reject(new Error('Message send timeout'));
        }
      }, 10000);

      const originalResolve = pendingMessages.current.get(clientMessageId);
      if (originalResolve) {
        pendingMessages.current.set(clientMessageId, () => {
          clearTimeout(timeout);
          originalResolve();
        });
      }

      socket.emit('send_message', { ...data, clientMessageId });
    });
  }, [socket, isConnected, user, addMessageInternal]);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    if (socket && isConnected) {
      socket.emit('typing', { conversationId, isTyping });
    }
  }, [socket, isConnected]);

  const markAsRead = useCallback((messageId: string, conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('message_read', { messageId, conversationId });
    }
  }, [socket, isConnected]);

  const markConversationRead = useCallback((conversationId: string) => {
    if (socket && isConnected) {
      socket.emit('mark_conversation_read', { conversationId });
      
      setConversationUnread(prev => {
        const newMap = new Map(prev);
        newMap.set(conversationId, 0);
        return newMap;
      });
      
      const newTotal = Array.from(conversationUnread.values()).reduce((sum, count) => sum + count, 0) - (conversationUnread.get(conversationId) || 0);
      setUnreadCount(newTotal);
    }
  }, [socket, isConnected, conversationUnread]);

  const getOnlineStatus = useCallback(async (userId: string): Promise<{ isOnline: boolean; lastSeen?: Date }> => {
    if (!socket || !isConnected) {
      return { isOnline: false };
    }

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ isOnline: false });
      }, 5000);

      socket.emit('get_online_status', { userId }, (response: any) => {
        clearTimeout(timeout);
        resolve({
          isOnline: response?.isOnline || false,
          lastSeen: response?.lastSeen ? new Date(response.lastSeen) : undefined,
        });
      });
    });
  }, [socket, isConnected]);

  // ==========================================
  // MESSAGE MANAGEMENT
  // ==========================================

  const setConversationMessages = useCallback((conversationId: string, newMessages: Message[]) => {
    setMessages(prev => {
      const newMessagesMap = new Map(prev);
      newMessagesMap.set(conversationId, newMessages);
      return newMessagesMap;
    });
  }, []);

  const addMessage = useCallback((conversationId: string, message: Message) => {
    addMessageInternal(conversationId, message);
  }, [addMessageInternal]);

  const updateMessage = useCallback((conversationId: string, messageId: string, updates: Partial<Message>) => {
    setMessages(prev => {
      const newMessages = new Map(prev);
      const conversationMessages = newMessages.get(conversationId);
      
      if (conversationMessages) {
        const index = conversationMessages.findIndex(m => m._id === messageId);
        if (index >= 0) {
          conversationMessages[index] = { ...conversationMessages[index], ...updates };
          newMessages.set(conversationId, [...conversationMessages]);
        }
      }
      
      return newMessages;
    });
  }, []);

  const updateMessageStatus = useCallback((messageId: string, status: string, data?: any) => {
    setMessages(prev => {
      const newMessages = new Map(prev);
      
      newMessages.forEach((conversationMessages, conversationId) => {
        const message = conversationMessages.find(m => m._id === messageId);
        if (message) {
          message.deliveryStatus = status as 'sent' | 'delivered' | 'read' | 'failed';
          if (status === 'read') {
            message.isRead = true;
            message.readAt = data?.readAt || new Date();
          }
        }
      });
      
      return newMessages;
    });
  }, []);

  // ==========================================
  // CONTEXT VALUE
  // ==========================================

  const value = useMemo(() => ({
    isConnected,
    connectionError,
    onlineUsers,
    typingUsers,
    joinConversation,
    leaveConversation,
    sendMessage,
    sendTyping,
    markAsRead,
    markConversationRead,
    getOnlineStatus,
    unreadCount,
    conversationUnread,
    messages,
    setConversationMessages,
    addMessage,
    updateMessage,
    updateMessageStatus,
  }), [
    isConnected,
    connectionError,
    onlineUsers,
    typingUsers,
    unreadCount,
    conversationUnread,
    messages,
    joinConversation,
    leaveConversation,
    sendMessage,
    sendTyping,
    markAsRead,
    markConversationRead,
    getOnlineStatus,
    setConversationMessages,
    addMessage,
    updateMessage,
    updateMessageStatus,
  ]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};

// ==========================================
// HOOK
// ==========================================

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export default SocketContext;