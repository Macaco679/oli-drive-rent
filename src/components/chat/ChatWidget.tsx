import { useEffect, useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { useChatWidget } from "@/contexts/ChatWidgetContext";
import { ChatConversationList } from "./ChatConversationList";
import { ChatConversationView } from "./ChatConversationView";
import { getCurrentUser } from "@/lib/supabase";
import { getOrCreateDirectConversation } from "@/lib/chatService";
import { cn } from "@/lib/utils";

export function ChatWidget() {
  const {
    isOpen,
    activeConversationId,
    toggleWidget,
    closeWidget,
    openConversation,
    pendingUserId,
    clearPendingUserId,
  } = useChatWidget();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  // Handle pending user conversation creation
  useEffect(() => {
    if (pendingUserId && isAuthenticated) {
      handleCreateConversation(pendingUserId);
    }
  }, [pendingUserId, isAuthenticated]);

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

  const handleCreateConversation = async (userId: string) => {
    try {
      const conversationId = await getOrCreateDirectConversation(userId);
      if (conversationId) {
        openConversation(conversationId);
      }
    } catch (error) {
      console.error("Error creating conversation:", error);
    } finally {
      clearPendingUserId();
    }
  };

  // Don't render if not authenticated
  if (loading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {/* Chat Window */}
      <div
        className={cn(
          "bg-card border border-border rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-out origin-bottom-right",
          isOpen
            ? "w-[360px] h-[500px] opacity-100 scale-100"
            : "w-0 h-0 opacity-0 scale-95 pointer-events-none"
        )}
      >
        {isOpen && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
              <h3 className="font-semibold">
                {activeConversationId ? "Conversa" : "Mensagens"}
              </h3>
              <button
                onClick={closeWidget}
                className="p-1 hover:bg-primary-foreground/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden">
              {activeConversationId ? (
                <ChatConversationView conversationId={activeConversationId} />
              ) : (
                <ChatConversationList />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toggle Button */}
      <button
        onClick={toggleWidget}
        className={cn(
          "w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95",
          isOpen && "bg-muted text-muted-foreground"
        )}
        aria-label={isOpen ? "Fechar chat" : "Abrir chat"}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </button>
    </div>
  );
}
