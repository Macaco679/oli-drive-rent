import { useState, useRef, useEffect } from "react";
import { Mic, Square, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ChatAudioRecorderProps {
  conversationId: string;
  onAudioSent: (audioUrl: string) => Promise<void>;
  disabled?: boolean;
}

export function ChatAudioRecorder({ conversationId, onAudioSent, disabled }: ChatAudioRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setRecording(true);
      setDuration(0);
      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      toast.error("Não foi possível acessar o microfone. Verifique as permissões.");
    }
  };

  const stopAndSend = async () => {
    if (!mediaRecorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;

    const blob = await new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        resolve(new Blob(chunksRef.current, { type: "audio/webm" }));
      };
      recorder.stop();
    });

    setRecording(false);
    setUploading(true);

    try {
      const fileName = `${conversationId}/${Date.now()}_audio.webm`;
      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(fileName, blob, { contentType: "audio/webm", upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chat-images").getPublicUrl(fileName);
      await onAudioSent(urlData.publicUrl);
    } catch (err) {
      console.error("Erro ao enviar áudio:", err);
      toast.error("Erro ao enviar áudio. Tente novamente.");
    } finally {
      setUploading(false);
      setDuration(0);
    }
  };

  const cancelRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    setRecording(false);
    setDuration(0);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (uploading) {
    return (
      <Button size="icon" variant="ghost" disabled className="h-9 w-9 rounded-full">
        <Loader2 className="w-5 h-5 animate-spin" />
      </Button>
    );
  }

  if (recording) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={cancelRecording}
          className="p-2 hover:bg-destructive/10 rounded-full transition-colors text-destructive"
          title="Cancelar"
        >
          <Square className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-xs font-mono text-destructive">{formatTime(duration)}</span>
        </div>
        <Button
          onClick={stopAndSend}
          size="icon"
          className="h-9 w-9 rounded-full"
          title="Enviar áudio"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled}
      className={cn(
        "p-2 hover:bg-secondary rounded-full transition-colors text-muted-foreground hover:text-foreground",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      title="Gravar áudio"
    >
      <Mic className="w-5 h-5" />
    </button>
  );
}
