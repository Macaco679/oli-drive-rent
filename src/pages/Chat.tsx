import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, Mic } from "lucide-react";
import { getCurrentUser, getProfile } from "@/lib/supabase";
import { getMessages, sendMessage, sendImageMessage, markConversationAsRead, Message } from "@/lib/chatService";
import { supabase } from "@/integrations/supabase/client";
import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import { ChatImageUpload } from "@/components/chat/ChatImageUpload";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { useChatTypingIndicator } from "@/hooks/useChatTypingIndicator";

// Helper para queries em tabelas ainda não tipadas
const db = supabase as any;

export default function Chat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherUserName, setOtherUserName] = useState<string>("Usuário");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Typing indicator hook
  const { isOtherUserTyping, handleInputChange, stopTyping } = useChatTypingIndicator(
    conversationId || "",
    currentUserId
  );

  useEffect(() => {
    if (conversationId) {
      loadChat();
      
      // Subscribe to new messages
      const channel = supabase
        .channel(`chat-page-${conversationId}`)
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
              return [...prev, newMsg];
            });
            if (newMsg.sender_id !== currentUserId) {
              markConversationAsRead(conversationId);
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [conversationId]);

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

    // Carregar mensagens
    const msgs = await getMessages(conversationId);
    setMessages(msgs);

    // Marcar como lida
    await markConversationAsRead(conversationId);

    // Buscar nome do outro participante
    const { data: participants } = await db
      .from("oli_conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", user.id)
      .limit(1)
      .single();

    if (participants) {
      const profile = await getProfile(participants.user_id);
      if (profile?.full_name) {
        setOtherUserName(profile.full_name);
      }
    }

    setLoading(false);
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !conversationId || sending) return;

    setSending(true);
    stopTyping();
    const sent = await sendMessage(conversationId, newMessage.trim());
    if (sent) {
      setNewMessage("");
      inputRef.current?.focus();
    }
    setSending(false);
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
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-semibold">
              {otherUserName.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="font-semibold">{otherUserName}</h1>
            {isOtherUserTyping ? (
              <p className="text-sm text-primary">Digitando...</p>
            ) : (
              <p className="text-sm text-muted-foreground">Conversa</p>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma mensagem ainda. Comece a conversa!
            </div>
          ) : (
            messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === currentUserId}
              />
            ))
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
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              size="icon"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </WebLayout>
  );
}
