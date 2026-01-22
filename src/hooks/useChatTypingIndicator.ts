import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TypingUser {
  id: string;
  name?: string;
}

export function useChatTypingIndicator(conversationId: string, currentUserId: string | null) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!conversationId || !currentUserId) return;

    // Create a presence channel for typing indicators
    const channel = supabase.channel(`typing-${conversationId}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typing: TypingUser[] = [];
        
        Object.entries(state).forEach(([key, presences]) => {
          if (key !== currentUserId && Array.isArray(presences)) {
            presences.forEach((presence: any) => {
              if (presence.isTyping) {
                typing.push({ id: key, name: presence.name });
              }
            });
          }
        });
        
        setTypingUsers(typing);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ isTyping: false });
        }
      });

    channelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [conversationId, currentUserId]);

  const startTyping = useCallback(async () => {
    if (!channelRef.current || isTypingRef.current) return;
    
    isTypingRef.current = true;
    await channelRef.current.track({ isTyping: true });

    // Auto-stop typing after 3 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, []);

  const stopTyping = useCallback(async () => {
    if (!channelRef.current) return;
    
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    await channelRef.current.track({ isTyping: false });
  }, []);

  const handleInputChange = useCallback(() => {
    startTyping();
  }, [startTyping]);

  return {
    typingUsers,
    handleInputChange,
    stopTyping,
    isOtherUserTyping: typingUsers.length > 0,
  };
}
