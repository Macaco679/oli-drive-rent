import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Message } from "@/lib/chatService";
import { useState } from "react";

interface ChatMessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function ChatMessageBubble({ message, isOwn }: ChatMessageBubbleProps) {
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  
  // Check if message is an image (type = 'image' or body contains image URL)
  const isImage = message.type === "image" || 
    (message.metadata as any)?.imageUrl || 
    (message.body?.startsWith("https://") && 
     (message.body?.includes("chat-images") || message.body?.match(/\.(jpg|jpeg|png|gif|webp)$/i)));

  const imageUrl = (message.metadata as any)?.imageUrl || message.body;

  return (
    <div className={cn("flex", isOwn ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl text-sm",
          isImage ? "p-1" : "px-3 py-2",
          isOwn
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-secondary text-secondary-foreground rounded-bl-sm"
        )}
      >
        {isImage && !imageError ? (
          <div className="relative">
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-secondary rounded-xl min-h-[100px] min-w-[150px]">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            <img
              src={imageUrl}
              alt="Imagem enviada"
              className={cn(
                "max-w-full rounded-xl cursor-pointer hover:opacity-90 transition-opacity",
                imageLoading && "opacity-0"
              )}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false);
                setImageError(true);
              }}
              onClick={() => window.open(imageUrl, "_blank")}
            />
          </div>
        ) : imageError ? (
          <p className="text-sm text-muted-foreground px-2 py-1">
            Erro ao carregar imagem
          </p>
        ) : (
          <p className="whitespace-pre-wrap break-words">{message.body}</p>
        )}
        
        <p
          className={cn(
            "text-[10px] mt-1",
            isImage && "px-2",
            isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
          )}
        >
          {format(new Date(message.created_at), "HH:mm", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}
