import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatAudioPlayerProps {
  src: string;
  isOwn: boolean;
}

export function ChatAudioPlayer({ src, isOwn }: ChatAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    const onMeta = () => setDuration(audio.duration || 0);
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play();
    }
    setPlaying(!playing);
  };

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[160px] px-2 py-1">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          isOwn ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
        )}
      >
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="h-1.5 rounded-full bg-foreground/20 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isOwn ? "bg-primary-foreground/70" : "bg-primary/60"
            )}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <span className={cn("text-[10px]", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {playing ? formatTime(audioRef.current?.currentTime || 0) : formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
