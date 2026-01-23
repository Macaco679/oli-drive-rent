import { useEffect, useState, useRef } from "react";
import { useChatWidget } from "@/contexts/ChatWidgetContext";
import { getMessages, sendMessage, sendImageMessage, markConversationAsRead, Message } from "@/lib/chatService";
import { getCurrentUser, getProfile } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Mic } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChatMessageBubble, MessageStatus } from "./ChatMessageBubble";
import { ChatImageUpload } from "./ChatImageUpload";
import { TypingIndicator } from "./TypingIndicator";
import { useChatTypingIndicator } from "@/hooks/useChatTypingIndicator";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { toast } from "sonner";

// Helper para queries em tabelas ainda não tipadas
const db = supabase as any;

interface ChatConversationViewProps {
  conversationId: string;
  onRead?: () => void;
}

export function ChatConversationView({ conversationId, onRead }: ChatConversationViewProps) {
  const { backToList } = useChatWidget();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUserName, setOtherUserName] = useState("Usuário");
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Notification sound hook
  const { playNotificationSound } = useNotificationSound();

  // Typing indicator hook
  const { isOtherUserTyping, handleInputChange, stopTyping } = useChatTypingIndicator(
    conversationId,
    currentUserId
  );

  // Initial load
  useEffect(() => {
    loadChat();
  }, [conversationId]);

  // Fallback sync: poll every 2s for first 30s, then every 10s
  useEffect(() => {
    if (!currentUserId || loading) return;

    let elapsed = 0;
    const fastInterval = 2000; // 2s
    const slowInterval = 10000; // 10s
    const fastDuration = 30000; // 30s of fast polling

    const poll = async () => {
      try {
        const msgs = await getMessages(conversationId);
        setMessages((prev) => {
          // Merge new messages, keeping optimistic ones
          const optimistic = prev.filter((m) => m.id.startsWith("temp-"));
          const realIds = new Set(msgs.map((m) => m.id));
          const keptOptimistic = optimistic.filter(
            (o) => !msgs.some((m) => m.body === o.body && m.sender_id === o.sender_id)
          );
          return [...msgs, ...keptOptimistic];
        });
      } catch (e) {
        console.warn("[ChatConversationView] Poll failed:", e);
      }
    };

    // Fast polling initially
    const fastId = window.setInterval(() => {
      elapsed += fastInterval;
      if (elapsed <= fastDuration) {
        poll();
      }
    }, fastInterval);

    // After 30s, switch to slow polling
    const slowTimeoutId = window.setTimeout(() => {
      window.clearInterval(fastId);
      const slowId = window.setInterval(poll, slowInterval);
      // Store for cleanup
      (window as any).__chatSlowPollId = slowId;
    }, fastDuration);

    return () => {
      window.clearInterval(fastId);
      window.clearTimeout(slowTimeoutId);
      if ((window as any).__chatSlowPollId) {
        window.clearInterval((window as any).__chatSlowPollId);
        delete (window as any).__chatSlowPollId;
      }
    };
  }, [conversationId, currentUserId, loading]);

  // Separate effect for realtime subscription - runs after currentUserId is set
  useEffect(() => {
    if (!currentUserId) return;

    console.log("[ChatConversationView] Setting up realtime subscription for conversation:", conversationId);

    const channel = supabase
      .channel(`widget-chat-${conversationId}-${currentUserId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "oli_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log("[ChatConversationView] Received new message:", payload.new);
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates (check both real id and temp ids)
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            // Also filter out temp messages that match this new message (optimistic update replacement)
            const filtered = prev.filter((m) => !m.id.startsWith('temp-') || m.body !== newMsg.body);
            return [...filtered, newMsg];
          });
          // Play notification sound and mark as read if message is from other user
          if (newMsg.sender_id !== currentUserId) {
            playNotificationSound();
            markConversationAsRead(conversationId);
            onRead?.();
            // Mark message as read
            setReadMessageIds((prev) => new Set([...prev, newMsg.id]));
          }
        }
      )
      .subscribe((status) => {
        console.log("[ChatConversationView] Subscription status:", status);
      });

    return () => {
      console.log("[ChatConversationView] Cleaning up subscription");
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, onRead, playNotificationSound]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChat = async () => {
    setLoading(true);
    try {
      const { user } = await getCurrentUser();
      if (!user) return;
      setCurrentUserId(user.id);

      // Load messages
      const msgs = await getMessages(conversationId);
      setMessages(msgs);

      // Mark as read
      await markConversationAsRead(conversationId);
      onRead?.();

      // Get other participant name
      const { data: participant } = await db
        .from("oli_conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id)
        .limit(1)
        .single();

      if (participant) {
        const profile = await getProfile(participant.user_id);
        if (profile?.full_name) {
          setOtherUserName(profile.full_name);
        }
      }
    } catch (error) {
      console.error("Error loading chat:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending || !currentUserId) return;

    const messageText = newMessage.trim();
    setSending(true);
    stopTyping();
    setNewMessage("");

    // Optimistic update - add message immediately to UI
    const optimisticMessage: Message = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      body: messageText,
      type: "text",
      metadata: {},
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
    };
    setMessages((prev) => [...prev, optimisticMessage]);

    try {
      const sent = await sendMessage(conversationId, messageText);
      if (sent) {
        // Replace optimistic message with real one
        setMessages((prev) => 
          prev.map((m) => m.id === optimisticMessage.id ? sent : m)
        );
        inputRef.current?.focus();
      } else {
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        setNewMessage(messageText); // Restore message
        toast.error("Não foi possível enviar a mensagem. Tente novamente.");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
      setNewMessage(messageText);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setSending(false);
    }
  };

  const handleImageUploaded = async (imageUrl: string) => {
    setSending(true);
    try {
      await sendImageMessage(conversationId, imageUrl);
    } catch (error) {
      console.error("Error sending image:", error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInputChangeLocal = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    handleInputChange();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-secondary/30">
        <button
          onClick={backToList}
          className="p-1.5 hover:bg-secondary rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-semibold text-sm">
            {otherUserName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{otherUserName}</p>
          {isOtherUserTyping && (
            <p className="text-xs text-muted-foreground">Digitando...</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            Nenhuma mensagem ainda. Comece a conversa!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            // Determine message status
            let status: MessageStatus = "sent";
            if (msg.id.startsWith("temp-")) {
              status = "sending";
            } else if (isOwn && readMessageIds.has(msg.id)) {
              status = "read";
            } else if (isOwn) {
              status = "delivered";
            }
            
            return (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                isOwn={isOwn}
                status={status}
              />
            );
          })
        )}
        {isOtherUserTyping && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-border bg-background">
        <div className="flex items-center gap-2">
          {/* Attachment buttons */}
          <div className="flex items-center gap-1">
            <ChatImageUpload
              conversationId={conversationId}
              onImageUploaded={handleImageUploaded}
              disabled={sending}
            />
            <button
              className="p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground"
              title="Gravar áudio"
            >
              <Mic className="w-5 h-5" />
            </button>
          </div>

          {/* Input */}
          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChangeLocal}
            onKeyPress={handleKeyPress}
            placeholder="Aa"
            className="flex-1 h-9 text-sm rounded-full"
            disabled={sending}
          />

          {/* Send button */}
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            size="icon"
            className="h-9 w-9 rounded-full"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
