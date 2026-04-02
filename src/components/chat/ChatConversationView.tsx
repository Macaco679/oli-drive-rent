import { useEffect, useState, useRef, useCallback } from "react";
import { useChatWidget } from "@/contexts/ChatWidgetContext";
import { getMessages, sendMessage, sendImageMessage, sendAudioMessage, markConversationAsRead, Message } from "@/lib/chatService";
import { getCurrentUser, getProfile } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChatMessageBubble, MessageStatus } from "./ChatMessageBubble";
import { ChatImageUpload } from "./ChatImageUpload";
import { ChatAudioRecorder } from "./ChatAudioRecorder";
import { TypingIndicator } from "./TypingIndicator";
import { useChatTypingIndicator } from "@/hooks/useChatTypingIndicator";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { toast } from "sonner";

const db = supabase as any;
const PAGE_SIZE = 30;

interface ChatConversationViewProps {
  conversationId: string;
  onRead?: () => void;
}

export function ChatConversationView({ conversationId, onRead }: ChatConversationViewProps) {
  const { backToList } = useChatWidget();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherUserName, setOtherUserName] = useState("Usuário");
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { playNotificationSound } = useNotificationSound();
  const { isOtherUserTyping, handleInputChange, stopTyping } = useChatTypingIndicator(
    conversationId,
    currentUserId
  );

  // Initial load
  useEffect(() => {
    loadChat();
  }, [conversationId]);

  // Supabase Presence for online status
  useEffect(() => {
    if (!currentUserId || !otherUserId) return;

    const presenceChannel = supabase.channel(`presence-chat-${conversationId}`, {
      config: { presence: { key: currentUserId } },
    });

    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();
        setIsOtherOnline(Object.keys(state).includes(otherUserId));
      })
      .on("presence", { event: "join" }, ({ key }) => {
        if (key === otherUserId) setIsOtherOnline(true);
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        if (key === otherUserId) setIsOtherOnline(false);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [conversationId, currentUserId, otherUserId]);

  // Fallback sync polling
  useEffect(() => {
    if (!currentUserId || loading) return;

    let elapsed = 0;
    const fastInterval = 2000;
    const slowInterval = 10000;
    const fastDuration = 30000;

    const poll = async () => {
      try {
        const msgs = await getMessages(conversationId, { limit: PAGE_SIZE });
        setMessages((prev) => {
          const optimistic = prev.filter((m) => m.id.startsWith("temp-"));
          const keptOptimistic = optimistic.filter(
            (o) => !msgs.some((m) => m.body === o.body && m.sender_id === o.sender_id)
          );
          return [...msgs, ...keptOptimistic];
        });
      } catch (e) {
        console.warn("[ChatConversationView] Poll failed:", e);
      }
    };

    const fastId = window.setInterval(() => {
      elapsed += fastInterval;
      if (elapsed <= fastDuration) poll();
    }, fastInterval);

    const slowTimeoutId = window.setTimeout(() => {
      window.clearInterval(fastId);
      const slowId = window.setInterval(poll, slowInterval);
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

  // Realtime subscription
  useEffect(() => {
    if (!currentUserId) return;

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
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            const filtered = prev.filter((m) => !m.id.startsWith("temp-") || m.body !== newMsg.body);
            return [...filtered, newMsg];
          });
          if (newMsg.sender_id !== currentUserId) {
            playNotificationSound();
            markConversationAsRead(conversationId);
            onRead?.();
            setReadMessageIds((prev) => new Set([...prev, newMsg.id]));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, onRead, playNotificationSound]);

  // Auto scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChat = async () => {
    setLoading(true);
    setHasMore(true);
    try {
      const { user } = await getCurrentUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const msgs = await getMessages(conversationId, { limit: PAGE_SIZE });
      setMessages(msgs);
      setHasMore(msgs.length >= PAGE_SIZE);

      await markConversationAsRead(conversationId);
      onRead?.();

      const { data: participant } = await db
        .from("oli_conversation_participants")
        .select("user_id")
        .eq("conversation_id", conversationId)
        .neq("user_id", user.id)
        .limit(1)
        .single();

      if (participant) {
        setOtherUserId(participant.user_id);
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

  // Load older messages (infinite scroll up)
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0) return;

    const oldestMessage = messages[0];
    if (!oldestMessage?.created_at) return;

    setLoadingMore(true);
    try {
      const olderMsgs = await getMessages(conversationId, {
        limit: PAGE_SIZE,
        before: oldestMessage.created_at,
      });

      if (olderMsgs.length === 0) {
        setHasMore(false);
      } else {
        const container = messagesContainerRef.current;
        const prevScrollHeight = container?.scrollHeight || 0;

        setMessages((prev) => [...olderMsgs, ...prev]);
        setHasMore(olderMsgs.length >= PAGE_SIZE);

        requestAnimationFrame(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      }
    } catch (error) {
      console.error("Error loading more messages:", error);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, loadingMore, hasMore, messages]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      if (target.scrollTop < 50 && hasMore && !loadingMore) {
        loadMoreMessages();
      }
    },
    [hasMore, loadingMore, loadMoreMessages]
  );

  const handleSend = async () => {
    if (!newMessage.trim() || sending || !currentUserId) return;

    const messageText = newMessage.trim();
    setSending(true);
    stopTyping();
    setNewMessage("");

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
        setMessages((prev) => prev.map((m) => (m.id === optimisticMessage.id ? sent : m)));
        inputRef.current?.focus();
      } else {
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMessage.id));
        setNewMessage(messageText);
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

  const handleAudioSent = async (audioUrl: string) => {
    setSending(true);
    try {
      await sendAudioMessage(conversationId, audioUrl);
    } catch (error) {
      console.error("Error sending audio:", error);
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
        <div className="relative">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-semibold text-sm">
              {otherUserName.charAt(0).toUpperCase()}
            </span>
          </div>
          {isOtherOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-background" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{otherUserName}</p>
          {isOtherUserTyping ? (
            <p className="text-xs text-primary">Digitando...</p>
          ) : isOtherOnline ? (
            <p className="text-xs text-emerald-600">Online</p>
          ) : null}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-2"
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!hasMore && messages.length > 0 && (
          <p className="text-center text-xs text-muted-foreground py-2">
            Início da conversa
          </p>
        )}

        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            Nenhuma mensagem ainda. Comece a conversa!
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            let status: MessageStatus = "sent";
            if (msg.id.startsWith("temp-")) {
              status = "sending";
            } else if (isOwn && readMessageIds.has(msg.id)) {
              status = "read";
            } else if (isOwn) {
              status = "delivered";
            }

            return (
              <ChatMessageBubble key={msg.id} message={msg} isOwn={isOwn} status={status} />
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
          <div className="flex items-center gap-1">
            <ChatImageUpload
              conversationId={conversationId}
              onImageUploaded={handleImageUploaded}
              disabled={sending}
            />
            <ChatAudioRecorder
              conversationId={conversationId}
              onAudioSent={handleAudioSent}
              disabled={sending}
            />
          </div>

          <Input
            ref={inputRef}
            value={newMessage}
            onChange={handleInputChangeLocal}
            onKeyPress={handleKeyPress}
            placeholder="Aa"
            className="flex-1 h-9 text-sm rounded-full"
            disabled={sending}
          />

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
