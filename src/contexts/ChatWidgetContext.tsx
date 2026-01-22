import { createContext, useContext, useState, ReactNode, useCallback } from "react";

interface ChatWidgetContextType {
  isOpen: boolean;
  activeConversationId: string | null;
  openWidget: () => void;
  closeWidget: () => void;
  toggleWidget: () => void;
  openConversation: (conversationId: string) => void;
  backToList: () => void;
  startConversationWith: (userId: string) => void;
  pendingUserId: string | null;
  clearPendingUserId: () => void;
}

const ChatWidgetContext = createContext<ChatWidgetContextType | undefined>(undefined);

export function ChatWidgetProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const openWidget = useCallback(() => setIsOpen(true), []);
  const closeWidget = useCallback(() => {
    setIsOpen(false);
    setActiveConversationId(null);
  }, []);
  const toggleWidget = useCallback(() => setIsOpen((prev) => !prev), []);

  const openConversation = useCallback((conversationId: string) => {
    setActiveConversationId(conversationId);
    setIsOpen(true);
  }, []);

  const backToList = useCallback(() => {
    setActiveConversationId(null);
  }, []);

  const startConversationWith = useCallback((userId: string) => {
    setPendingUserId(userId);
    setActiveConversationId(null);
    setIsOpen(true);
  }, []);

  const clearPendingUserId = useCallback(() => {
    setPendingUserId(null);
  }, []);

  return (
    <ChatWidgetContext.Provider
      value={{
        isOpen,
        activeConversationId,
        openWidget,
        closeWidget,
        toggleWidget,
        openConversation,
        backToList,
        startConversationWith,
        pendingUserId,
        clearPendingUserId,
      }}
    >
      {children}
    </ChatWidgetContext.Provider>
  );
}

export function useChatWidget() {
  const context = useContext(ChatWidgetContext);
  if (!context) {
    throw new Error("useChatWidget must be used within a ChatWidgetProvider");
  }
  return context;
}
