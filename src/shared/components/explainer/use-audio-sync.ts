"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface UseAudioSyncOptions {
  audioUrl: string;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number) => void;
  /** Total duration used when no audioUrl is provided (timer-driven playback). */
  fallbackDuration?: number;
}

interface UseAudioSyncReturn {
  audioRef: React.RefObject<HTMLAudioElement | null>;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playbackRate: number;
  isLoaded: boolean;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
}

export function useAudioSync({
  audioUrl,
  onEnded,
  onTimeUpdate,
  fallbackDuration = 0,
}: UseAudioSyncOptions): UseAudioSyncReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  const rafRef = useRef<number | null>(null);

  // Store callbacks in refs to avoid stale closure / rAF restart issues
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
  }, [onTimeUpdate]);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  // ---- Timer mode (no audio) ------------------------------------------------
  // When there's no audioUrl, we drive currentTime with requestAnimationFrame
  // using wall-clock elapsed time.

  const hasAudio = !!audioUrl;
  const timerStartRef = useRef<number | null>(null); // DOMHighResTimeStamp when play() was called
  const timerOffsetRef = useRef(0); // accumulated time from previous play sessions (for pause/resume)
  const playbackRateRef = useRef(1);

  // Keep playbackRateRef in sync
  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  const timerTick = useCallback(() => {
    if (timerStartRef.current === null) return;
    const elapsed =
      timerOffsetRef.current +
      ((performance.now() - timerStartRef.current) / 1000) * playbackRateRef.current;
    const totalDur = fallbackDuration;
    if (elapsed >= totalDur) {
      setCurrentTime(totalDur);
      setIsPlaying(false);
      timerStartRef.current = null;
      timerOffsetRef.current = 0;
      onTimeUpdateRef.current?.(totalDur);
      onEndedRef.current?.();
      return;
    }
    setCurrentTime(elapsed);
    onTimeUpdateRef.current?.(elapsed);
    rafRef.current = requestAnimationFrame(timerTick);
  }, [fallbackDuration]);

  // Initialise timer mode immediately so the player doesn't wait for audio
  useEffect(() => {
    if (!hasAudio && fallbackDuration > 0) {
      setDuration(fallbackDuration);
      setIsLoaded(true);
    }
  }, [hasAudio, fallbackDuration]);

  // ---- Audio-driven rAF loop ------------------------------------------------

  const updateTime = useCallback(() => {
    const audio = audioRef.current;
    if (audio && !audio.paused) {
      setCurrentTime(audio.currentTime);
      onTimeUpdateRef.current?.(audio.currentTime);
      rafRef.current = requestAnimationFrame(updateTime);
    }
  }, []);

  // ---- Controls -------------------------------------------------------------

  const play = useCallback(() => {
    if (!hasAudio) {
      // Timer mode
      timerStartRef.current = performance.now();
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(timerTick);
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().catch(() => {
      // Autoplay may be blocked by browser policy
    });
  }, [hasAudio, timerTick]);

  const pause = useCallback(() => {
    if (!hasAudio) {
      if (timerStartRef.current !== null) {
        timerOffsetRef.current +=
          ((performance.now() - timerStartRef.current) / 1000) * playbackRateRef.current;
        timerStartRef.current = null;
      }
      setIsPlaying(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    audioRef.current?.pause();
  }, [hasAudio]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const seek = useCallback(
    (time: number) => {
      const clamped = Math.max(0, Math.min(time, duration || 0));
      if (!hasAudio) {
        timerOffsetRef.current = clamped;
        if (timerStartRef.current !== null) {
          timerStartRef.current = performance.now();
        }
        setCurrentTime(clamped);
        onTimeUpdateRef.current?.(clamped);
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      audio.currentTime = clamped;
      setCurrentTime(audio.currentTime);
      onTimeUpdateRef.current?.(audio.currentTime);
    },
    [hasAudio, duration]
  );

  const setVolume = useCallback((v: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const clamped = Math.max(0, Math.min(1, v));
    audio.volume = clamped;
    setVolumeState(clamped);
  }, []);

  const setPlaybackRate = useCallback(
    (rate: number) => {
      if (!hasAudio) {
        // Commit elapsed time at old rate, then switch
        if (timerStartRef.current !== null) {
          timerOffsetRef.current +=
            ((performance.now() - timerStartRef.current) / 1000) * playbackRateRef.current;
          timerStartRef.current = performance.now();
        }
        setPlaybackRateState(rate);
        return;
      }
      const audio = audioRef.current;
      if (!audio) return;
      audio.playbackRate = rate;
      setPlaybackRateState(rate);
    },
    [hasAudio]
  );

  // ---- Audio element event bindings -----------------------------------------

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsLoaded(true);
    };

    const handlePlay = () => {
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(updateTime);
    };

    const handlePause = () => {
      setIsPlaying(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      setCurrentTime(audio.duration);
      onEndedRef.current?.();
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnded);

    // If metadata already loaded (cached audio)
    if (audio.readyState >= 1) {
      handleLoadedMetadata();
    }

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnded);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [audioUrl, updateTime]);

  return {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    isLoaded,
    play,
    pause,
    togglePlay,
    seek,
    setVolume,
    setPlaybackRate,
  };
}
