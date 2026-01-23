import { useEffect, useState, useCallback } from "react";
import { getMyConversations, ConversationWithDetails } from "@/lib/chatService";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUser } from "@/lib/supabase";
import { MessageCircle, Search, Car, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ChatConversationListProps {
  onOpenConversation: (conversationId: string) => void;
}

// Group conversations by vehicle context
interface ConversationGroup {
  vehicleTitle?: string;
  vehicleId?: string;
  conversations: ConversationWithDetails[];
}

function groupConversationsByVehicle(conversations: ConversationWithDetails[]): ConversationGroup[] {
  const grouped = new Map<string, ConversationGroup>();
  const noVehicle: ConversationWithDetails[] = [];

  for (const conv of conversations) {
    if (conv.vehicleContext) {
      const key = conv.vehicleContext.vehicleId;
      if (!grouped.has(key)) {
        grouped.set(key, {
          vehicleId: conv.vehicleContext.vehicleId,
          vehicleTitle: conv.vehicleContext.vehicleTitle,
          conversations: [],
        });
      }
      grouped.get(key)!.conversations.push(conv);
    } else {
      noVehicle.push(conv);
    }
  }

  // Convert to array - put groups with vehicles first, then ungrouped
  const result: ConversationGroup[] = [];
  
  for (const group of grouped.values()) {
    result.push(group);
  }
  
  if (noVehicle.length > 0) {
    result.push({ conversations: noVehicle });
  }

  return result;
}

export function ChatConversationList({ onOpenConversation }: ChatConversationListProps) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await getMyConversations();
      setConversations(data);
    } catch (error) {
      console.error("Error loading conversations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const init = async () => {
      const { user } = await getCurrentUser();
      if (user) {
        setCurrentUserId(user.id);
      }
      loadConversations();
    };
    init();
  }, [loadConversations]);

  // Real-time subscription for new messages to update the list
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`conversation-list-${currentUserId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "oli_messages",
        },
        (payload) => {
          const newMsg = payload.new as any;
          
          // Update the specific conversation with the new message
          setConversations((prev) => {
            const updated = prev.map((conv) => {
              if (conv.id === newMsg.conversation_id) {
                const updatedConv: ConversationWithDetails = {
                  ...conv,
                  lastMessage: {
                    id: newMsg.id,
                    conversation_id: newMsg.conversation_id,
                    body: newMsg.body,
                    created_at: newMsg.created_at,
                    sender_id: newMsg.sender_id,
                    metadata: newMsg.metadata || {},
                    type: newMsg.type || "text",
                    edited_at: newMsg.edited_at || null,
                    deleted_at: newMsg.deleted_at || null,
                  },
                  // Increment unread if message is from other user
                  unreadCount: newMsg.sender_id !== currentUserId 
                    ? (conv.unreadCount || 0) + 1 
                    : conv.unreadCount,
                };
                return updatedConv;
              }
              return conv;
            });
            
            // Sort by last message time (most recent first)
            return updated.sort((a, b) => {
              const aTime = a.lastMessage?.created_at || a.created_at || "";
              const bTime = b.lastMessage?.created_at || b.created_at || "";
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            });
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const name = conv.otherParticipant?.full_name || "";
    const vehicle = conv.vehicleContext?.vehicleTitle || "";
    return (
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vehicle.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const groups = groupConversationsByVehicle(filteredConversations);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-muted-foreground">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-secondary/30">
        <h2 className="font-semibold text-base">Mensagens</h2>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conversa..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {groups.length === 0 || (groups.length === 1 && groups[0].conversations.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageCircle className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">
              {searchQuery
                ? "Nenhuma conversa encontrada"
                : "Nenhuma conversa ainda"}
            </p>
            {!searchQuery && (
              <p className="text-muted-foreground/70 text-xs mt-1">
                Inicie uma conversa com um proprietário
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {groups.map((group, groupIndex) => (
              <div key={group.vehicleId || `no-vehicle-${groupIndex}`}>
                {/* Vehicle group header */}
                {group.vehicleTitle && (
                  <div className="px-4 py-2 bg-secondary/50 flex items-center gap-2">
                    <Car className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground truncate">
                      {group.vehicleTitle}
                    </span>
                  </div>
                )}
                
                {/* Conversations in group */}
                {group.conversations.map((conv) => (
                  <button
                    key={conv.id}
                    onClick={() => onOpenConversation(conv.id)}
                    className="w-full px-4 py-3 flex items-start gap-3 hover:bg-secondary/50 transition-colors text-left"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary font-semibold">
                        {(conv.otherParticipant?.full_name || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        {/* Role label */}
                        {conv.roleLabel && (
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px] px-1.5 py-0 h-4",
                              conv.roleLabel === "Proprietário" 
                                ? "border-primary/50 text-primary" 
                                : "border-accent-foreground/50 text-accent-foreground"
                            )}
                          >
                            {conv.roleLabel === "Proprietário" ? (
                              <User className="w-2.5 h-2.5 mr-0.5" />
                            ) : null}
                            {conv.roleLabel}
                          </Badge>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "font-medium truncate text-sm",
                            conv.unreadCount && conv.unreadCount > 0 && "font-semibold"
                          )}
                        >
                          {conv.otherParticipant?.full_name || "Usuário"}
                        </span>
                        {conv.lastMessage && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(conv.lastMessage.created_at), "HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <p
                          className={cn(
                            "text-xs text-muted-foreground truncate",
                            conv.unreadCount && conv.unreadCount > 0 && "text-foreground font-medium"
                          )}
                        >
                          {conv.lastMessage?.metadata?.imageUrl 
                            ? "📷 Imagem" 
                            : conv.lastMessage?.body || "Nenhuma mensagem"}
                        </p>
                        {conv.unreadCount && conv.unreadCount > 0 && (
                          <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center flex-shrink-0 font-bold">
                            {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
