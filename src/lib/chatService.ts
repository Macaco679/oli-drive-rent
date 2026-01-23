import { supabase } from "@/integrations/supabase/client";
import { notifyNewMessage } from "./notificationService";

export interface Conversation {
  id: string;
  type: string;
  subject?: string;
  created_by?: string;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  last_read_at?: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  type: string;
  body?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  edited_at?: string;
  deleted_at?: string;
}

export interface ConversationWithDetails extends Conversation {
  participants?: ConversationParticipant[];
  lastMessage?: Message;
  otherParticipant?: {
    id: string;
    full_name?: string;
    role?: string; // 'owner' | 'renter' | 'both'
  };
  unreadCount?: number;
  // Vehicle context (if conversation originated from a vehicle/rental)
  vehicleContext?: {
    vehicleId: string;
    vehicleTitle: string;
  };
  // Derived role label
  roleLabel?: string; // "Proprietário" | "Locatário"
}

// Helper para queries em tabelas ainda não tipadas
const db = supabase as any;

// Buscar ou criar conversa direta entre dois usuários usando a RPC function
export async function getOrCreateDirectConversation(otherUserId: string): Promise<string | null> {
  try {
    // Use the RPC function that handles everything with proper permissions
    const { data, error } = await supabase.rpc("oli_create_direct_conversation", {
      other_user_id: otherUserId,
    });

    if (error) {
      console.error("Erro ao criar/buscar conversa:", error);
      return null;
    }

    return data as string;
  } catch (error) {
    console.error("Erro ao criar/buscar conversa:", error);
    return null;
  }
}

// Buscar todas as conversas do usuário com contexto de veículo
export async function getMyConversations(): Promise<ConversationWithDetails[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Buscar conversas onde o usuário é participante
  const { data: myParticipations } = await db
    .from("oli_conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("user_id", user.id);

  if (!myParticipations || myParticipations.length === 0) return [];

  const conversationIds = myParticipations.map((p: any) => p.conversation_id);
  const lastReadMap = new Map(myParticipations.map((p: any) => [p.conversation_id, p.last_read_at]));

  // Buscar detalhes das conversas
  const { data: conversations } = await db
    .from("oli_conversations")
    .select("*")
    .in("id", conversationIds)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (!conversations) return [];

  // Para cada conversa, buscar o outro participante, última mensagem e contexto
  const conversationsWithDetails: ConversationWithDetails[] = await Promise.all(
    conversations.map(async (conv: any) => {
      // Buscar outro participante
      const { data: otherParticipant } = await db
        .from("oli_conversation_participants")
        .select("user_id")
        .eq("conversation_id", conv.id)
        .neq("user_id", user.id)
        .limit(1)
        .single();

      let otherUser: { id: string; full_name?: string; role?: string } | null = null;
      let roleLabel: string | undefined;
      
      if (otherParticipant) {
        const { data: profile } = await supabase
          .from("oli_profiles")
          .select("id, full_name, role")
          .eq("id", otherParticipant.user_id)
          .single();
        
        if (profile) {
          otherUser = { 
            id: profile.id, 
            full_name: profile.full_name || undefined,
            role: profile.role || undefined
          };
          
          // Determine role label based on context
          // Check if current user has vehicles (is an owner)
          const { count: vehicleCount } = await db
            .from("oli_vehicles")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", user.id);
          
          // Check if other user has vehicles
          const { count: otherVehicleCount } = await db
            .from("oli_vehicles")
            .select("*", { count: "exact", head: true })
            .eq("owner_id", profile.id);
          
          // If other user has vehicles, they are a "Proprietário" to us
          // If we have vehicles, other user is likely a "Locatário"
          if (otherVehicleCount && otherVehicleCount > 0) {
            roleLabel = "Proprietário";
          } else if (vehicleCount && vehicleCount > 0) {
            roleLabel = "Locatário";
          }
        }
      }

      // Buscar última mensagem
      const { data: lastMessage } = await db
        .from("oli_messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Contar mensagens não lidas
      const lastRead = lastReadMap.get(conv.id);
      let unreadCount = 0;
      if (lastRead) {
        const { count } = await db
          .from("oli_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .neq("sender_id", user.id)
          .gt("created_at", lastRead)
          .is("deleted_at", null);
        unreadCount = count || 0;
      } else {
        const { count } = await db
          .from("oli_messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conv.id)
          .neq("sender_id", user.id)
          .is("deleted_at", null);
        unreadCount = count || 0;
      }

      // Try to find vehicle context from rentals between these users
      let vehicleContext: { vehicleId: string; vehicleTitle: string } | undefined;
      if (otherUser) {
        const { data: rental } = await db
          .from("oli_rentals")
          .select("vehicle_id, oli_vehicles(id, title, brand, model)")
          .or(`renter_id.eq.${user.id},owner_id.eq.${user.id}`)
          .or(`renter_id.eq.${otherUser.id},owner_id.eq.${otherUser.id}`)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (rental?.oli_vehicles) {
          const v = rental.oli_vehicles;
          vehicleContext = {
            vehicleId: v.id,
            vehicleTitle: v.title || `${v.brand || ''} ${v.model || ''}`.trim() || 'Veículo'
          };
        }
      }

      return {
        ...conv,
        lastMessage: lastMessage || undefined,
        otherParticipant: otherUser || undefined,
        unreadCount,
        vehicleContext,
        roleLabel,
      } as ConversationWithDetails;
    })
  );

  return conversationsWithDetails;
}

// Buscar mensagens de uma conversa
export async function getMessages(conversationId: string): Promise<Message[]> {
  const { data } = await db
    .from("oli_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  return data || [];
}

// Enviar mensagem de texto
export async function sendMessage(conversationId: string, body: string): Promise<Message | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await db
    .from("oli_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      type: "text",
      body,
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao enviar mensagem:", error);
    return null;
  }

  // Atualizar last_message_at da conversa
  await db
    .from("oli_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  // Enviar notificação por email para o destinatário
  sendMessageNotification(conversationId, user.id, body);

  return data;
}

// Função auxiliar para enviar notificação de mensagem (fire and forget)
async function sendMessageNotification(conversationId: string, senderId: string, body: string) {
  try {
    // Buscar o outro participante da conversa
    const { data: participants } = await db
      .from("oli_conversation_participants")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .neq("user_id", senderId);

    if (!participants || participants.length === 0) return;

    // Buscar nome do remetente
    const { data: senderProfile } = await supabase
      .from("oli_profiles")
      .select("full_name")
      .eq("id", senderId)
      .single();

    const senderName = senderProfile?.full_name || "Alguém";

    // Notificar cada participante (exceto o remetente)
    for (const participant of participants) {
      notifyNewMessage(participant.user_id, senderName, body);
    }
  } catch (error) {
    console.error("Erro ao enviar notificação de mensagem:", error);
  }
}

// Enviar mensagem de imagem
export async function sendImageMessage(conversationId: string, imageUrl: string): Promise<Message | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await db
    .from("oli_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      // DB enum supports only 'text' | 'system'. We keep image semantics in metadata/body.
      type: "text",
      body: imageUrl,
      metadata: { imageUrl },
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao enviar imagem:", error);
    return null;
  }

  // Atualizar last_message_at da conversa
  await db
    .from("oli_conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  return data;
}

// Marcar conversa como lida
export async function markConversationAsRead(conversationId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await db
    .from("oli_conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id);
}
