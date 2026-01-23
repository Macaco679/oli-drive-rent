import { useEffect, useState, useCallback } from "react";
import { useChatWidget } from "@/contexts/ChatWidgetContext";
import { getCurrentUser } from "@/lib/supabase";
import { getOrCreateDirectConversation, getMyConversations, markConversationAsRead } from "@/lib/chatService";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, X } from "lucide-react";
import { ChatConversationList } from "./ChatConversationList";
import { ChatConversationView } from "./ChatConversationView";
import { cn } from "@/lib/utils";
import { useNotificationSound } from "@/hooks/useNotificationSound";

export function ChatWidget() {
  const {
    isOpen,
    activeConversationId,
    toggleWidget,
    openConversation,
    pendingUserId,
    clearPendingUserId,
  } = useChatWidget();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [totalUnread, setTotalUnread] = useState(0);
  const { playNotificationSound } = useNotificationSound();

  // Check authentication
  useEffect(() => {
    checkAuth();
  }, []);

  // Load unread count and subscribe to new messages
  useEffect(() => {
    if (!isAuthenticated) return;

    loadUnreadCount();

    // Subscribe to new messages globally
    const channel = supabase
      .channel("global-messages-notification")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "oli_messages",
        },
        async (payload) => {
          const newMsg = payload.new as any;
          const { user } = await getCurrentUser();
          
          // Only count if not from current user
          if (user && newMsg.sender_id !== user.id) {
            // Play notification sound
            playNotificationSound();
            
            // Update badge if not in active conversation
            if (!isOpen || newMsg.conversation_id !== activeConversationId) {
              setTotalUnread((prev) => prev + 1);
            } else {
              // Auto mark as read if conversation is open
              markConversationAsRead(newMsg.conversation_id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAuthenticated, isOpen, activeConversationId, playNotificationSound]);

  // Reset unread when opening widget
  useEffect(() => {
    if (isOpen && !activeConversationId) {
      // When opening the list, reload unread count
      loadUnreadCount();
    }
  }, [isOpen, activeConversationId]);

  const checkAuth = async () => {
    try {
      const { user } = await getCurrentUser();
      setIsAuthenticated(!!user);
    } catch {
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = useCallback(async () => {
    try {
      const conversations = await getMyConversations();
      const total = conversations.reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);
      setTotalUnread(total);
    } catch (error) {
      console.error("Error loading unread count:", error);
    }
  }, []);

  // Handle pending user conversation
  useEffect(() => {
    if (pendingUserId && isAuthenticated) {
      handleCreateConversation(pendingUserId);
      clearPendingUserId();
    }
  }, [pendingUserId, isAuthenticated, clearPendingUserId]);

  const handleCreateConversation = async (userId: string) => {
    const conversationId = await getOrCreateDirectConversation(userId);
    if (conversationId) {
      openConversation(conversationId);
    }
  };

  // When entering a conversation, mark as read and reset unread
  const handleOpenConversation = useCallback(async (conversationId: string) => {
    openConversation(conversationId);
    // Mark as read immediately
    await markConversationAsRead(conversationId);
    // Reload unread count
    setTimeout(loadUnreadCount, 300);
  }, [openConversation, loadUnreadCount]);

  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Chat Window */}
      <div
        className={cn(
          "bg-background border border-border rounded-xl shadow-2xl overflow-hidden transition-all duration-300 ease-out",
          isOpen
            ? "w-[360px] h-[480px] opacity-100 scale-100"
            : "w-0 h-0 opacity-0 scale-95 pointer-events-none"
        )}
      >
        {isOpen && (
          activeConversationId ? (
            <ChatConversationView conversationId={activeConversationId} onRead={loadUnreadCount} />
          ) : (
            <ChatConversationList onOpenConversation={handleOpenConversation} />
          )
        )}
      </div>

      {/* Toggle Button with Badge */}
      <button
        onClick={toggleWidget}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200",
          isOpen
            ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <div className="relative">
            <MessageCircle className="w-6 h-6" />
            {totalUnread > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-bold rounded-full animate-pulse">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </div>
        )}
      </button>
    </div>
  );
}
