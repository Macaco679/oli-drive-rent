import { useEffect, useState } from "react";
import { WebLayout } from "@/components/layout/WebLayout";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MessageCircle, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/supabase";
import { getMyConversations, ConversationWithDetails } from "@/lib/chatService";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Messages() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const { user } = await getCurrentUser();
    if (!user) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    setIsAuthenticated(true);
    const convs = await getMyConversations();
    setConversations(convs);
    setLoading(false);
  };

  if (loading) {
    return (
      <WebLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </WebLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <WebLayout>
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mx-auto mb-8">
              <MessageCircle className="w-12 h-12 text-muted-foreground" />
            </div>
            
            <h1 className="text-3xl font-bold mb-4">Mensagens</h1>
            
            <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
              Faça login para ver suas conversas com proprietários e locatários.
            </p>
            
            <Button onClick={() => navigate("/auth")} size="lg">
              Entrar ou criar conta
            </Button>
          </div>
        </div>
      </WebLayout>
    );
  }

  return (
    <WebLayout>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold mb-6">Mensagens</h1>

        {conversations.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Nenhuma conversa ainda</h2>
            <p className="text-muted-foreground mb-6">
              Quando você iniciar uma conversa com um proprietário, ela aparecerá aqui.
            </p>
            <Button onClick={() => navigate("/search")} variant="outline">
              Buscar veículos
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => navigate(`/chat/${conv.id}`)}
                className="w-full flex items-center gap-4 p-4 bg-card hover:bg-secondary/50 rounded-xl border border-border transition-colors text-left"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="w-6 h-6 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold truncate">
                      {conv.otherParticipant?.full_name || "Usuário"}
                    </h3>
                    {conv.lastMessage && (
                      <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                        {formatDistanceToNow(new Date(conv.lastMessage.created_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </span>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground truncate">
                    {conv.lastMessage?.body || "Nenhuma mensagem ainda"}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {conv.unreadCount && conv.unreadCount > 0 && (
                    <span className="w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                      {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </WebLayout>
  );
}
