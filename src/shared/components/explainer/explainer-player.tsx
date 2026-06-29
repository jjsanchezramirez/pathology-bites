"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { cn } from "@/shared/utils";
import { useAudioSync } from "./use-audio-sync";
import { useExplainerEngine } from "./use-explainer-engine";
import { useResourcePreloader } from "./use-resource-preloader";
import { ExplainerViewport } from "./explainer-viewport";
import { ExplainerControls } from "./explainer-controls";
import { useReducedMotion } from "./use-reduced-motion";
import type { ExplainerPlayerProps, CaptionChunk } from "@/shared/types/explainer";
import { slideStarts, stepPointsForLesson } from "@/shared/lesson/evaluate";
import { captionsForAudio } from "@/shared/lesson/captions";

export function ExplainerPlayer({
  lesson,
  audioUrl: audioUrlProp,
  autoPlay = false,
  className,
  onEnded,
  onTimeUpdate,
  onAudioLoaded,
  seekToTime,
  captions: captionsProp,
}: ExplainerPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const audioUrl = audioUrlProp ?? lesson.audio?.url ?? "";
  const duration = useMemo(() => slideStarts(lesson).duration, [lesson]);
  const captions = useMemo(
    () => captionsProp ?? captionsForAudio(lesson.audio),
    [captionsProp, lesson.audio]
  );
  // Slide-boundary ticks for the scrubber (absolute seconds, excluding 0).
  const markers = useMemo(() => slideStarts(lesson).starts.slice(1), [lesson]);
  // Reduced-motion multiplier (0 pins camera + suppresses scale-pop).
  const motion = useReducedMotion();
  // Stable key for resume-position persistence.
  const resumeKey = lesson.id ?? audioUrl;
  // Step points (slide starts + element appearance times) for step mode.
  const stepPoints = useMemo(() => stepPointsForLesson(lesson), [lesson]);

  // Hover-scrub preview time (null = not hovering) and step mode.
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [stepMode, setStepMode] = useState(false);
  const nextStopRef = useRef<number | null>(null);

  // CC visibility — defaults on when captions are provided
  const [captionsVisible, setCaptionsVisible] = useState(true);

  // Fullscreen state — tracked via fullscreenchange event so it stays in sync
  // when the user presses Escape or uses the browser's native controls
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Controls visibility — hide after inactivity (only relevant in fullscreen)
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset CC when captions prop changes (new sequence generated)
  useEffect(() => {
    if (captions && captions.length > 0) setCaptionsVisible(true);
  }, [captions]);

  // Sync isFullscreen with the browser's native fullscreen state
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
      // Always show controls when fullscreen state changes
      setControlsVisible(true);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }, []);

  // Auto-hide controls after 3s of inactivity (fullscreen only)
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (document.fullscreenElement) setControlsVisible(false);
    }, 3000);
  }, []);

  useEffect(() => {
    if (!isFullscreen) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    }
  }, [isFullscreen]);

  // Preload all resources before playback
  const preloader = useResourcePreloader({
    lesson,
    audioUrl,
  });

  const audio = useAudioSync({
    audioUrl,
    onEnded,
    onTimeUpdate,
    fallbackDuration: duration,
  });

  // Frame shown = hover-preview time when hovering the scrubber, else committed time.
  const displayTime = hoverTime ?? audio.currentTime;

  const engine = useExplainerEngine({
    lesson,
    currentTime: displayTime,
    motion,
  });

  // Find the active caption chunk for the displayed time
  const activeCaption = useMemo((): CaptionChunk | null => {
    if (!captions || !captionsVisible) return null;
    return captions.find((c) => displayTime >= c.start && displayTime < c.end) ?? null;
  }, [captions, captionsVisible, displayTime]);

  // ---- Step mode + hover-scrub handlers ------------------------------------

  const nextStep = useCallback(
    (t: number): number | null => stepPoints.find((p) => p > t + 0.05) ?? null,
    [stepPoints]
  );
  const prevStep = useCallback(
    (t: number): number => {
      for (let i = stepPoints.length - 1; i >= 0; i--) {
        if (stepPoints[i] < t - 0.05) return stepPoints[i];
      }
      return 0;
    },
    [stepPoints]
  );

  // Play/pause that, in step mode, only plays up to the next step point.
  const togglePlay = useCallback(() => {
    if (!preloader.isReady) return;
    if (audio.isPlaying) {
      audio.pause();
      return;
    }
    nextStopRef.current = stepMode ? nextStep(audio.currentTime) : null;
    audio.play();
  }, [audio, preloader.isReady, stepMode, nextStep]);

  const handleSeek = useCallback(
    (t: number) => {
      setHoverTime(null);
      audio.seek(t);
    },
    [audio]
  );
  const onStepNext = useCallback(() => {
    const n = nextStep(audio.currentTime);
    if (n != null) audio.seek(n);
  }, [audio, nextStep]);
  const onStepPrev = useCallback(() => audio.seek(prevStep(audio.currentTime)), [audio, prevStep]);
  const onToggleStepMode = useCallback(() => {
    nextStopRef.current = null;
    setStepMode((v) => !v);
  }, []);

  // Auto-pause at the next step point while playing in step mode.
  useEffect(() => {
    if (!stepMode || !audio.isPlaying || nextStopRef.current == null) return;
    if (audio.currentTime >= nextStopRef.current - 0.01) {
      const stop = nextStopRef.current;
      nextStopRef.current = null;
      audio.pause();
      audio.seek(stop);
    }
  }, [audio, stepMode, audio.currentTime, audio.isPlaying]);

  // Auto-play
  useEffect(() => {
    if (autoPlay && preloader.isReady && audio.isLoaded) {
      audio.play();
    }
    // Only on mount + when loaded
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, preloader.isReady, audio.isLoaded]);

  // Seek when seekToTime changes
  useEffect(() => {
    if (seekToTime !== undefined && audio.isLoaded) {
      audio.seek(seekToTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekToTime]);

  // Notify parent when audio duration is available
  useEffect(() => {
    if (audio.isLoaded && audio.duration > 0 && onAudioLoaded) {
      onAudioLoaded(audio.duration);
    }
  }, [audio.isLoaded, audio.duration, onAudioLoaded]);

  // Resume position — restore once when loaded (unless the caller drives seek).
  const resumedRef = useRef(false);
  useEffect(() => {
    if (resumedRef.current || !audio.isLoaded || !resumeKey || seekToTime !== undefined) return;
    resumedRef.current = true;
    try {
      const saved = parseFloat(localStorage.getItem(`explainer-resume:${resumeKey}`) || "");
      if (isFinite(saved) && saved > 1 && saved < (audio.duration || duration) - 1) {
        audio.seek(saved);
      }
    } catch {
      /* localStorage unavailable */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.isLoaded, audio.duration]);

  // Persist position (throttled to ~1s of movement).
  const lastSavedRef = useRef(0);
  useEffect(() => {
    if (!resumeKey) return;
    const t = audio.currentTime;
    if (Math.abs(t - lastSavedRef.current) < 1) return;
    lastSavedRef.current = t;
    try {
      localStorage.setItem(`explainer-resume:${resumeKey}`, String(t));
    } catch {
      /* localStorage unavailable */
    }
  }, [audio.currentTime, resumeKey]);

  const handleViewportClick = useCallback(() => {
    togglePlay();
  }, [togglePlay]);

  // Keyboard controls
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (stepMode) onStepPrev();
          else audio.seek(Math.max(0, audio.currentTime - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          if (stepMode) onStepNext();
          else audio.seek(Math.min(audio.duration, audio.currentTime + 5));
          break;
        case "j":
          e.preventDefault();
          audio.seek(Math.max(0, audio.currentTime - 10));
          break;
        case "l":
          e.preventDefault();
          audio.seek(Math.min(audio.duration, audio.currentTime + 10));
          break;
        case "0":
          e.preventDefault();
          audio.seek(0);
          break;
        case "ArrowUp":
          e.preventDefault();
          audio.setVolume(Math.min(1, audio.volume + 0.05));
          break;
        case "ArrowDown":
          e.preventDefault();
          audio.setVolume(Math.max(0, audio.volume - 0.05));
          break;
        case "m":
          e.preventDefault();
          audio.setVolume(audio.volume > 0 ? 0 : 1);
          break;
        case "f":
          e.preventDefault();
          toggleFullscreen();
          break;
      }
    },
    [audio, toggleFullscreen, togglePlay, stepMode, onStepPrev, onStepNext]
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        "focus:outline-none",
        isFullscreen && "flex items-center justify-center bg-black w-full h-full",
        className
      )}
      onKeyDown={handleKeyDown}
      onMouseMove={isFullscreen ? resetHideTimer : undefined}
      tabIndex={0}
      role="application"
      aria-label="Explanation video player"
      style={{ containerType: "inline-size" }}
    >
      {/* Video viewport + overlaid controls.
          In fullscreen: fill height and let aspect-ratio constrain the width.
          In normal mode: fill the container width with rounded corners. */}
      <div
        className={cn(
          "relative overflow-hidden bg-black group",
          isFullscreen ? "h-full" : "w-full rounded-2xl"
        )}
        style={isFullscreen ? { aspectRatio: lesson.aspectRatio.replace(":", "/") } : undefined}
      >
        <ExplainerViewport
          imageUrl={engine.imageUrl}
          backgroundColor={engine.backgroundColor}
          incomingImageUrl={engine.incomingImageUrl}
          incomingBackgroundColor={engine.incomingBackgroundColor}
          transform={engine.transform}
          incomingTransform={engine.incomingTransform}
          highlights={engine.highlights}
          arrows={engine.arrows}
          textOverlays={engine.textOverlays}
          svgOverlays={engine.svgOverlays}
          transitionOpacity={engine.transitionOpacity}
          incomingOpacity={engine.incomingOpacity}
          aspectRatio={lesson.aspectRatio}
          onClick={handleViewportClick}
        />

        {/* Caption overlay — rendered outside the engine to avoid interpolation blinks */}
        {activeCaption && (
          <div
            className="absolute inset-x-0 flex justify-center pointer-events-none transition-all duration-200"
            style={{ bottom: controlsVisible ? "15%" : "6%", padding: "0 1cqw" }}
          >
            <div
              className="text-white text-center leading-snug"
              style={{
                fontSize: "1.75cqw", // 1.05rem converted to cqw (1.05 * 1.67)
                backgroundColor: "rgba(0,0,0,0.55)",
                maxWidth: "80%",
                padding: "0.5cqw 1cqw",
                borderRadius: "0.4cqw",
              }}
            >
              {activeCaption.words && activeCaption.words.length > 0
                ? activeCaption.words.map((w, i) => {
                    const spoken = displayTime >= w.start;
                    const active = spoken && displayTime < w.end;
                    return (
                      <span
                        key={i}
                        style={{ opacity: spoken ? 1 : 0.55, fontWeight: active ? 700 : 400 }}
                      >
                        {w.text}
                        {i < activeCaption.words!.length - 1 ? " " : ""}
                      </span>
                    );
                  })
                : activeCaption.text}
            </div>
          </div>
        )}

        {/* Controls overlay — always inside the viewport, shown on hover or when not fullscreen */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 transition-opacity duration-300",
            "bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8",
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <ExplainerControls
            isPlaying={audio.isPlaying}
            currentTime={audio.currentTime}
            duration={audio.duration}
            volume={audio.volume}
            playbackRate={audio.playbackRate}
            isReady={preloader.isReady}
            onPlay={togglePlay}
            onPause={audio.pause}
            onSeek={handleSeek}
            onVolumeChange={audio.setVolume}
            onPlaybackRateChange={audio.setPlaybackRate}
            captionsAvailable={!!captions && captions.length > 0}
            captionsVisible={captionsVisible}
            onToggleCaptions={() => setCaptionsVisible((v) => !v)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            markers={markers}
            onHover={setHoverTime}
            stepMode={stepMode}
            onToggleStepMode={onToggleStepMode}
            onStepPrev={onStepPrev}
            onStepNext={onStepNext}
          />
        </div>

        {/* Loading overlay */}
        {preloader.isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center space-y-3">
              <div className="text-white/80 text-sm">Loading...</div>
              <div className="w-32 h-0.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white/60 transition-all duration-300"
                  style={{ width: `${preloader.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {preloader.error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center space-y-1 max-w-md px-4">
              <div className="text-red-400 text-sm">Failed to load</div>
              <div className="text-white/50 text-xs">{preloader.error}</div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      {audioUrl && <audio ref={audio.audioRef} src={audioUrl} preload="auto" />}
    </div>
  );
}
