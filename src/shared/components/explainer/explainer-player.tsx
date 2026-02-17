"use client";

import { useRef, useCallback, useEffect, useState, useMemo } from "react";
import { cn } from "@/shared/utils";
import { useAudioSync } from "./use-audio-sync";
import { useExplainerEngine } from "./use-explainer-engine";
import { useResourcePreloader } from "./use-resource-preloader";
import { ExplainerViewport } from "./explainer-viewport";
import { ExplainerControls } from "./explainer-controls";
import type { ExplainerPlayerProps, CaptionChunk } from "@/shared/types/explainer";

export function ExplainerPlayer({
  sequence,
  audioUrl,
  autoPlay = false,
  className,
  onEnded,
  onTimeUpdate,
  onAudioLoaded,
  seekToTime,
  captions,
}: ExplainerPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
    sequence,
    audioUrl,
  });

  const audio = useAudioSync({
    audioUrl,
    onEnded,
    onTimeUpdate,
  });

  const engine = useExplainerEngine({
    sequence,
    currentTime: audio.currentTime,
  });

  // Find the active caption chunk for the current time
  const activeCaption = useMemo((): CaptionChunk | null => {
    if (!captions || !captionsVisible) return null;
    return captions.find((c) => audio.currentTime >= c.start && audio.currentTime < c.end) ?? null;
  }, [captions, captionsVisible, audio.currentTime]);

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

  const handleViewportClick = useCallback(() => {
    if (preloader.isReady) {
      audio.togglePlay();
    }
  }, [audio, preloader.isReady]);

  // Keyboard controls
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          audio.togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          audio.seek(Math.max(0, audio.currentTime - 5));
          break;
        case "ArrowRight":
          e.preventDefault();
          audio.seek(Math.min(audio.duration, audio.currentTime + 5));
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
    [audio, toggleFullscreen]
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
    >
      {/* Video viewport + overlaid controls.
          In fullscreen: fill height and let aspect-ratio constrain the width.
          In normal mode: fill the container width with rounded corners. */}
      <div
        className={cn(
          "relative overflow-hidden bg-black group",
          isFullscreen ? "h-full" : "w-full rounded-2xl"
        )}
        style={isFullscreen ? { aspectRatio: sequence.aspectRatio.replace(":", "/") } : undefined}
      >
        <ExplainerViewport
          currentSegment={engine.currentSegment}
          incomingSegment={engine.incomingSegment}
          transform={engine.interpolatedTransform}
          highlights={engine.activeHighlights}
          arrows={engine.activeArrows}
          textOverlays={engine.activeTextOverlays}
          transitionOpacity={engine.transitionOpacity}
          incomingOpacity={engine.incomingOpacity}
          aspectRatio={sequence.aspectRatio}
          onClick={handleViewportClick}
        />

        {/* Caption overlay — rendered outside the engine to avoid interpolation blinks */}
        {activeCaption && (
          <div
            className="absolute inset-x-0 flex justify-center px-4 pointer-events-none transition-all duration-200"
            style={{ bottom: controlsVisible ? "15%" : "6%" }}
          >
            <div
              className="px-3 py-1.5 rounded text-white text-center leading-snug"
              style={{
                fontSize: "1.05rem",
                backgroundColor: "rgba(0,0,0,0.55)",
                maxWidth: "80%",
              }}
            >
              {activeCaption.text}
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
            onPlay={audio.play}
            onPause={audio.pause}
            onSeek={audio.seek}
            onVolumeChange={audio.setVolume}
            onPlaybackRateChange={audio.setPlaybackRate}
            captionsAvailable={!!captions && captions.length > 0}
            captionsVisible={captionsVisible}
            onToggleCaptions={() => setCaptionsVisible((v) => !v)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
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
