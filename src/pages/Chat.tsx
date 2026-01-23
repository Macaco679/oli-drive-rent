import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Mic, Loader2 } from "lucide-react";
import { getCurrentUser, getProfile } from "@/lib/supabase";
import { getMessages, sendMessage, sendImageMessage, markConversationAsRead, Message } from "@/lib/chatService";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessageBubble, MessageStatus } from "@/components/chat/ChatMessageBubble";
import { ChatImageUpload } from "@/components/chat/ChatImageUpload";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useChatTypingIndicator } from "@/hooks/useChatTypingIndicator";
import { useNotificationSound } from "@/hooks/useNotificationSound";
import { toast } from "sonner";

const db = supabase as any;
const PAGE_SIZE = 30;

export default function Chat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherUserName, setOtherUserName] = useState<string>("Usuário");
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { playNotificationSound } = useNotificationSound();
  const { isOtherUserTyping, handleInputChange, stopTyping } = useChatTypingIndicator(
    conversationId || "",
    currentUserId
  );

  useEffect(() => {
    if (conversationId) {
      loadChat();
    }
  }, [conversationId]);

  // Supabase Presence for online status
  useEffect(() => {
    if (!conversationId || !currentUserId || !otherUserId) return;

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

  // Realtime subscription
  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    const channel = supabase
      .channel(`chat-page-${conversationId}-${currentUserId}-${Date.now()}`)
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
            setReadMessageIds((prev) => new Set([...prev, newMsg.id]));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId, playNotificationSound]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadChat = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setCurrentUserId(user.id);

    if (!conversationId) return;

    // Load initial messages with pagination
    const msgs = await getMessages(conversationId, { limit: PAGE_SIZE });
    setMessages(msgs);
    setHasMore(msgs.length >= PAGE_SIZE);

    await markConversationAsRead(conversationId);

    // Get other participant
    const { data: participants } = await db
      .from("oli_conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", user.id)
      .limit(1)
      .single();

    if (participants) {
      setOtherUserId(participants.user_id);
      const profile = await getProfile(participants.user_id);
      if (profile?.full_name) {
        setOtherUserName(profile.full_name);
      }
    }

    setLoading(false);
  };

  // Load older messages (infinite scroll up)
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore || messages.length === 0 || !conversationId) return;

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
    if (!newMessage.trim() || !conversationId || sending || !currentUserId) return;

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
    if (!conversationId) return;

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
      <WebLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Carregando conversa...</p>
        </div>
      </WebLayout>
    );
  }

  return (
    <WebLayout>
      <div className="max-w-3xl mx-auto h-[calc(100vh-180px)] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 p-4 border-b border-border">
          <button
            onClick={() => navigate("/messages")}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-semibold">
                {otherUserName.charAt(0).toUpperCase()}
              </span>
            </div>
            {isOtherOnline && (
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
            )}
          </div>
          <div>
            <h1 className="font-semibold">{otherUserName}</h1>
            {isOtherUserTyping ? (
              <p className="text-sm text-primary">Digitando...</p>
            ) : isOtherOnline ? (
              <p className="text-sm text-emerald-600">Online</p>
            ) : (
              <p className="text-sm text-muted-foreground">Conversa</p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-4"
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
            <div className="text-center text-muted-foreground py-8">
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
              <TypingIndicator userName={otherUserName} />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-3 items-center">
            <div className="flex items-center gap-1">
              <ChatImageUpload
                conversationId={conversationId || ""}
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
            <Input
              ref={inputRef}
              value={newMessage}
              onChange={handleInputChangeLocal}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              className="flex-1"
              disabled={sending}
            />
            <Button onClick={handleSend} disabled={!newMessage.trim() || sending} size="icon">
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </WebLayout>
  );
}
