// Hook for playing notification sounds
import { useCallback, useRef, useEffect } from "react";

const NOTIFICATION_SOUND_URL = "https://cdn.pixabay.com/audio/2022/03/24/audio_715e1d36bc.mp3";

export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Pre-load the audio
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.5;
    audioRef.current.preload = "auto";

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      if (audioRef.current) {
        // Reset and play
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((e) => {
          // Ignore autoplay policy errors
          console.debug("Could not play notification sound:", e);
        });
      }
    } catch (error) {
      console.debug("Error playing notification sound:", error);
    }
  }, []);

  return { playNotificationSound };
}
