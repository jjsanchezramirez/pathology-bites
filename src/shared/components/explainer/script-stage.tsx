"use client";

// Renders a script lesson at a given time: the five scene templates, laid out
// with ordinary CSS on a 16:9 stage and animated only with the fixed motion set
// (one fade, one zoom, one easing curve). All sizes are in cqw (percent of the
// stage width), so a lesson looks the same at any player size.

import { memo, useState, type CSSProperties, type ReactNode } from "react";
import { lessonSans } from "@/shared/fonts/lesson-fonts";
import type {
  Beat,
  ImageRegion,
  Scene,
  SceneImage,
  ScriptLesson,
} from "@/shared/lesson/script/types";
import type { SceneTiming, ScriptTimeline } from "@/shared/lesson/script/timeline";
import { locate } from "@/shared/lesson/script/timeline";
import {
  MOTION,
  NO_ZOOM,
  fadeIn,
  fadeStyle,
  fadeWindow,
  lerpZoom,
  zoomCss,
  zoomTarget,
  type ZoomTarget,
} from "@/shared/lesson/script/motion";

export const STAGE_THEME = {
  background: "#FBFAF7",
  ink: "#14212B",
  inkSoft: "#33434F",
  accent: "#1C7D88",
  accentSoft: "#E3F0F1",
  /** Marks drawn on pictures: warm yellow reads on H&E, IHC and gross photos alike. */
  mark: "#F4BE1A",
  dim: "rgba(12, 20, 28, 0.62)",
} as const;

const T = STAGE_THEME;
const PAD_X = 6;
const HEADING_TOP = 4.6;
const CONTENT_TOP = 13;
const STAGE_H = 56.25;

interface ScriptStageProps {
  lesson: ScriptLesson;
  timeline: ScriptTimeline;
  /** Absolute seconds. */
  time: number;
  /** 0..1 reduced-motion multiplier; 0 turns zooms into rings. */
  motion?: number;
  onClick?: () => void;
  className?: string;
}

export function ScriptStage({
  lesson,
  timeline,
  time,
  motion = 1,
  onClick,
  className,
}: ScriptStageProps) {
  const pos = locate(timeline, time);
  if (pos.sceneIndex < 0) {
    return <div className={className} style={{ ...rootStyle, background: T.background }} />;
  }
  const i = pos.sceneIndex;
  const st = timeline.scenes[i];
  const next = lesson.scenes[i + 1];
  const fadeStart = st.start + st.duration - MOTION.sceneFade;
  const incoming = next && time >= fadeStart ? fadeIn(time, fadeStart, MOTION.sceneFade) : 0;

  return (
    <div
      className={`${lessonSans.className} ${className ?? ""}`}
      style={{ ...rootStyle, background: T.background }}
      onClick={onClick}
    >
      <SceneView scene={lesson.scenes[i]} timing={st} local={pos.local} motion={motion} />
      {incoming > 0 && next && (
        <div
          style={{ position: "absolute", inset: 0, opacity: incoming, background: T.background }}
        >
          <SceneView scene={next} timing={timeline.scenes[i + 1]} local={0} motion={motion} />
        </div>
      )}
    </div>
  );
}

const rootStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  overflow: "hidden",
  containerType: "inline-size",
  color: T.ink,
  userSelect: "none",
  cursor: "pointer",
};

// ---- Shared pieces ------------------------------------------------------------

interface SceneViewProps {
  scene: Scene;
  timing: SceneTiming;
  local: number;
  motion: number;
}

/** Start and end (the next beat's start, or null) of each beat's on-screen window. */
function windows(timing: SceneTiming): Array<{ start: number; end: number | null }> {
  return timing.beats.map((b, k) => ({
    start: b.start,
    end: k + 1 < timing.beats.length ? timing.beats[k + 1].start : null,
  }));
}

const SceneView = memo(function SceneView({ scene, timing, local, motion }: SceneViewProps) {
  switch (scene.template) {
    case "title":
      return <TitleScene scene={scene} timing={timing} local={local} motion={motion} />;
    case "image":
      return <ImageScene scene={scene} timing={timing} local={local} motion={motion} />;
    case "compare":
      return <CompareScene scene={scene} timing={timing} local={local} motion={motion} />;
    case "ladder":
      return <LadderScene scene={scene} timing={timing} local={local} motion={motion} />;
    case "takehome":
    default:
      return <TakeHomeScene scene={scene} timing={timing} local={local} motion={motion} />;
  }
});

function Heading({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div
      style={{
        position: "absolute",
        left: `${PAD_X}cqw`,
        right: `${PAD_X}cqw`,
        top: `${HEADING_TOP}cqw`,
        fontSize: "3.3cqw",
        fontWeight: 600,
        lineHeight: 1.15,
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </div>
  );
}

function Fade({
  p,
  motion,
  children,
  style,
}: {
  p: number;
  motion: number;
  children: ReactNode;
  style?: CSSProperties;
}) {
  const f = fadeStyle(p);
  const transform = motion > 0 ? f.transform : undefined;
  return <div style={{ ...style, opacity: f.opacity, transform }}>{children}</div>;
}

// ---- Title --------------------------------------------------------------------

function TitleScene({ scene, timing, local, motion }: SceneViewProps) {
  const lines = scene.beats
    .map((b, k) => ({ b, w: timing.beats[k] }))
    .filter(({ b }) => b.text?.trim());
  return (
    <div
      style={{
        position: "absolute",
        left: `${PAD_X + 2}cqw`,
        right: `${PAD_X + 6}cqw`,
        top: 0,
        bottom: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "6cqw",
          height: "0.4cqw",
          borderRadius: "0.2cqw",
          background: T.accent,
          marginBottom: "2.2cqw",
        }}
      />
      <div
        style={{ fontSize: "5.4cqw", fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.02em" }}
      >
        {scene.heading}
      </div>
      {lines.map(({ b, w }) => (
        <Fade key={b.id} p={fadeIn(local, w.start)} motion={motion} style={{ marginTop: "1.6cqw" }}>
          <div style={{ fontSize: "2.4cqw", lineHeight: 1.3, color: T.inkSoft }}>{b.text}</div>
        </Fade>
      ))}
      <div
        style={{
          position: "absolute",
          bottom: "4cqw",
          left: 0,
          fontSize: "1.2cqw",
          fontWeight: 600,
          color: T.accent,
        }}
      >
        Pathology Bites
      </div>
    </div>
  );
}

// ---- Image with callouts ----------------------------------------------------

/** Natural aspect of an image (from the lesson, or measured once it loads). */
function useAspect(image: SceneImage | undefined): [number, (n: number) => void] {
  const known = image?.width && image?.height ? image.width / image.height : null;
  const [measured, setMeasured] = useState<{ url: string; aspect: number } | null>(null);
  const aspect = known ?? (measured && measured.url === image?.url ? measured.aspect : 4 / 3);
  return [aspect, (n: number) => image && setMeasured({ url: image.url, aspect: n })];
}

function ImageScene({ scene, timing, local, motion }: SceneViewProps) {
  const [aspect, setAspect] = useAspect(scene.image);
  const wins = windows(timing);

  // Fit the picture into the left area.
  const maxW = 58;
  const maxH = STAGE_H - CONTENT_TOP - 6;
  let boxW = maxW;
  let boxH = boxW / aspect;
  if (boxH > maxH) {
    boxH = maxH;
    boxW = boxH * aspect;
  }
  const listLeft = PAD_X + boxW + 3.5;

  // Camera: each zoom beat zooms in when it starts and back out when the next beat starts.
  let zoom: ZoomTarget = NO_ZOOM;
  if (motion > 0) {
    scene.beats.forEach((b, k) => {
      if (b.mark !== "zoom" || !b.region) return;
      const w = wins[k];
      if (local < w.start) return;
      const amount =
        fadeIn(local, w.start, MOTION.zoom) *
        (w.end == null ? 1 : 1 - fadeIn(local, w.end, MOTION.zoom));
      zoom = lerpZoom(NO_ZOOM, zoomTarget(b.region), amount * motion);
    });
  }

  let number = 0;
  const items = scene.beats.map((b, k) => {
    const n = b.region ? ++number : null;
    return { b, k, n };
  });
  const shown = items.filter(({ b }) => b.text?.trim());
  const activeIndex = (() => {
    let a = -1;
    wins.forEach((w, k) => {
      if (local >= w.start) a = k;
    });
    return a;
  })();

  return (
    <>
      <Heading>{scene.heading}</Heading>
      <div
        style={{
          position: "absolute",
          left: `${PAD_X}cqw`,
          top: `${CONTENT_TOP}cqw`,
          width: `${boxW}cqw`,
          height: `${boxH}cqw`,
          borderRadius: "0.8cqw",
          overflow: "hidden",
          background: T.ink,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transform: zoomCss(zoom),
            transformOrigin: "50% 50%",
            willChange: "transform",
          }}
        >
          {scene.image?.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={scene.image.url}
              alt={scene.image.alt ?? ""}
              draggable={false}
              onLoad={(e) => {
                const el = e.currentTarget;
                if (el.naturalWidth && el.naturalHeight) {
                  setAspect(el.naturalWidth / el.naturalHeight);
                }
              }}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "fill",
              }}
            />
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
                fontSize: "1.6cqw",
              }}
            >
              Choose a picture
            </div>
          )}
          {items.map(({ b, k, n }) => {
            if (!b.region) return null;
            const mark =
              motion > 0 ? (b.mark ?? "ring") : b.mark === "zoom" ? "ring" : (b.mark ?? "ring");
            if (mark === "zoom") return null;
            const p = fadeWindow(local, wins[k].start, wins[k].end);
            if (p <= 0) return null;
            return (
              <RegionMark
                key={b.id}
                region={b.region}
                kind={mark}
                number={n}
                opacity={p}
                scale={zoom.scale}
              />
            );
          })}
        </div>
      </div>
      {scene.credit && (
        <div
          style={{
            position: "absolute",
            left: `${PAD_X}cqw`,
            top: `${CONTENT_TOP + boxH + 0.8}cqw`,
            width: `${boxW}cqw`,
            fontSize: "1.05cqw",
            color: T.inkSoft,
          }}
        >
          {scene.credit}
        </div>
      )}
      <div
        style={{
          position: "absolute",
          left: `${listLeft}cqw`,
          right: `${PAD_X}cqw`,
          top: `${CONTENT_TOP + 0.4}cqw`,
          display: "flex",
          flexDirection: "column",
          gap: "1.5cqw",
        }}
      >
        {shown.map(({ b, k, n }) => {
          const active = k === activeIndex;
          return (
            <Fade key={b.id} p={fadeIn(local, wins[k].start)} motion={motion}>
              <div style={{ display: "flex", gap: "1cqw", alignItems: "flex-start" }}>
                {n != null && <NumberBadge n={n} active={active} />}
                <div
                  style={{
                    fontSize: "1.9cqw",
                    lineHeight: 1.28,
                    fontWeight: n == null ? 600 : 400,
                  }}
                >
                  {b.text}
                  {b.detail && (
                    <div style={{ fontSize: "1.5cqw", color: T.inkSoft, marginTop: "0.3cqw" }}>
                      {b.detail}
                    </div>
                  )}
                </div>
              </div>
            </Fade>
          );
        })}
      </div>
    </>
  );
}

function NumberBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <div
      style={{
        flex: "none",
        width: "2.3cqw",
        height: "2.3cqw",
        marginTop: "0.05cqw",
        borderRadius: "50%",
        border: `0.18cqw solid ${T.accent}`,
        background: active ? T.accent : "transparent",
        color: active ? "#FFFFFF" : T.accent,
        fontSize: "1.3cqw",
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {n}
    </div>
  );
}

function RegionMark({
  region,
  kind,
  number,
  opacity,
  scale,
}: {
  region: ImageRegion;
  kind: "ring" | "spotlight";
  number: number | null;
  opacity: number;
  /** Current zoom, so strokes keep their on-screen width while zoomed. */
  scale: number;
}) {
  const box: CSSProperties = {
    position: "absolute",
    left: `${region.x}%`,
    top: `${region.y}%`,
    width: `${region.w}%`,
    height: `${region.h}%`,
    opacity,
    pointerEvents: "none",
  };
  const stroke = 0.3 / scale;
  if (kind === "spotlight") {
    return (
      <div
        style={{
          ...box,
          borderRadius: `${0.6 / scale}cqw`,
          boxShadow: `0 0 0 200cqw ${T.dim}`,
          outline: `${stroke}cqw solid ${T.mark}`,
        }}
      />
    );
  }
  return (
    <div style={box}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          border: `${stroke}cqw solid ${T.mark}`,
          boxShadow: `0 0 0 ${0.12 / scale}cqw rgba(0,0,0,0.35), inset 0 0 0 ${0.12 / scale}cqw rgba(0,0,0,0.35)`,
        }}
      />
      {number != null && (
        <div
          style={{
            position: "absolute",
            right: "4%",
            top: "4%",
            transform: "translate(50%, -50%)",
            width: `${2 / scale}cqw`,
            height: `${2 / scale}cqw`,
            borderRadius: "50%",
            background: T.mark,
            color: T.ink,
            fontSize: `${1.15 / scale}cqw`,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 0 0.1cqw rgba(0,0,0,0.25)",
          }}
        >
          {number}
        </div>
      )}
    </div>
  );
}

// ---- Side by side -------------------------------------------------------------

function CompareScene({ scene, timing, local, motion }: SceneViewProps) {
  const wins = windows(timing);
  const withTiming = scene.beats.map((b, k) => ({ b, w: wins[k] }));
  const side = (s: "left" | "right") => withTiming.filter(({ b }) => b.side === s);
  const closing = withTiming.filter(({ b }) => !b.side && b.text?.trim());
  const hasImages = scene.beats.some((b) => b.side && b.image?.url);

  const panel = (items: typeof withTiming) => {
    const first = items[0];
    const panelP = first ? fadeIn(local, first.w.start) : 0;
    const image = items.find(({ b }) => b.image?.url)?.b.image;
    return (
      <Fade p={panelP} motion={motion} style={{ flex: 1, minWidth: 0 }}>
        {image && (
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 9",
              borderRadius: "0.8cqw",
              overflow: "hidden",
              background: T.ink,
              marginBottom: "1.4cqw",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={image.url}
              alt={image.alt ?? ""}
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}
        <div
          style={{
            background: hasImages ? "transparent" : T.accentSoft,
            borderRadius: "1cqw",
            padding: hasImages ? 0 : "2.2cqw 2.4cqw",
            minHeight: hasImages ? undefined : "15cqw",
          }}
        >
          {items.map(({ b, w }, idx) => (
            <Fade
              key={b.id}
              p={idx === 0 ? 1 : fadeIn(local, w.start)}
              motion={motion}
              style={{ marginTop: idx === 0 ? 0 : "1.2cqw" }}
            >
              {b.text && (
                <div
                  style={{
                    fontSize: idx === 0 ? "2.5cqw" : "2cqw",
                    fontWeight: 600,
                    lineHeight: 1.2,
                    color: idx === 0 ? T.accent : T.ink,
                  }}
                >
                  {b.text}
                </div>
              )}
              {b.detail && (
                <div style={{ fontSize: "2cqw", lineHeight: 1.32, marginTop: "0.6cqw" }}>
                  {b.detail}
                </div>
              )}
            </Fade>
          ))}
        </div>
      </Fade>
    );
  };

  return (
    <>
      <Heading>{scene.heading}</Heading>
      <div
        style={{
          position: "absolute",
          left: `${PAD_X}cqw`,
          right: `${PAD_X}cqw`,
          top: `${CONTENT_TOP}cqw`,
          display: "flex",
          flexDirection: "column",
          gap: "2.6cqw",
        }}
      >
        <div style={{ display: "flex", gap: "3.5cqw" }}>
          {panel(side("left"))}
          {panel(side("right"))}
        </div>
        {closing.map(({ b, w }) => (
          <Fade key={b.id} p={fadeIn(local, w.start)} motion={motion}>
            <div style={{ fontSize: "2.3cqw", fontWeight: 600, lineHeight: 1.25 }}>{b.text}</div>
            {b.detail && (
              <div style={{ fontSize: "1.8cqw", color: T.inkSoft, marginTop: "0.4cqw" }}>
                {b.detail}
              </div>
            )}
          </Fade>
        ))}
      </div>
    </>
  );
}

// ---- Step ladder ---------------------------------------------------------------

function LadderScene({ scene, timing, local, motion }: SceneViewProps) {
  const wins = windows(timing);
  const rungs = scene.beats.map((b, k) => ({ b, k })).filter(({ b }) => b.text?.trim());
  const density = rungs.length <= 4 ? 1 : rungs.length === 5 ? 0.92 : 0.84;
  // A rung stays highlighted until the next rung appears.
  const rungEnd = (idx: number) => (idx + 1 < rungs.length ? wins[rungs[idx + 1].k].start : null);

  return (
    <>
      <Heading>{scene.heading}</Heading>
      <div
        style={{
          position: "absolute",
          left: `${PAD_X}cqw`,
          right: `${PAD_X}cqw`,
          top: `${CONTENT_TOP}cqw`,
          display: "flex",
          flexDirection: "column",
          gap: `${0.9 * density}cqw`,
        }}
      >
        {rungs.map(({ b, k }, idx) => {
          const start = wins[k].start;
          const active = fadeWindow(local, start, rungEnd(idx));
          const reached = local >= start;
          return (
            <Fade key={b.id} p={fadeIn(local, start)} motion={motion}>
              <div
                style={{
                  position: "relative",
                  display: "flex",
                  gap: "1.6cqw",
                  alignItems: "center",
                  padding: `${0.9 * density}cqw 1.4cqw`,
                  borderRadius: "0.8cqw",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "0.8cqw",
                    background: T.accentSoft,
                    opacity: active,
                  }}
                />
                <div
                  style={{
                    position: "relative",
                    flex: "none",
                    width: `${2.8 * density}cqw`,
                    height: `${2.8 * density}cqw`,
                    borderRadius: "50%",
                    background: reached && active > 0.5 ? T.accent : "transparent",
                    border: `0.2cqw solid ${T.accent}`,
                    color: reached && active > 0.5 ? "#FFFFFF" : T.accent,
                    fontSize: `${1.45 * density}cqw`,
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ position: "relative", minWidth: 0 }}>
                  <div
                    style={{ fontSize: `${2.2 * density}cqw`, fontWeight: 600, lineHeight: 1.2 }}
                  >
                    {b.text}
                  </div>
                  {b.detail && (
                    <div
                      style={{
                        fontSize: `${1.75 * density}cqw`,
                        lineHeight: 1.3,
                        color: T.inkSoft,
                        marginTop: "0.25cqw",
                      }}
                    >
                      {b.detail}
                    </div>
                  )}
                </div>
              </div>
            </Fade>
          );
        })}
      </div>
    </>
  );
}

// ---- Take-home ------------------------------------------------------------------

function TakeHomeScene({ scene, timing, local, motion }: SceneViewProps) {
  const wins = windows(timing);
  const points = scene.beats.map((b, k) => ({ b, k })).filter(({ b }) => b.text?.trim());
  return (
    <>
      <Heading>{scene.heading}</Heading>
      <div
        style={{
          position: "absolute",
          left: `${PAD_X + 0.4}cqw`,
          right: `${PAD_X + 4}cqw`,
          top: `${CONTENT_TOP + 2}cqw`,
          display: "flex",
          flexDirection: "column",
          gap: "2.4cqw",
        }}
      >
        {points.map(({ b, k }) => (
          <Fade key={b.id} p={fadeIn(local, wins[k].start)} motion={motion}>
            <div style={{ display: "flex", gap: "1.8cqw", alignItems: "flex-start" }}>
              <div
                style={{
                  flex: "none",
                  width: "1cqw",
                  height: "1cqw",
                  marginTop: "1.05cqw",
                  borderRadius: "50%",
                  background: T.accent,
                }}
              />
              <div>
                <div style={{ fontSize: "2.8cqw", fontWeight: 600, lineHeight: 1.22 }}>
                  {b.text}
                </div>
                {b.detail && (
                  <div
                    style={{
                      fontSize: "2cqw",
                      lineHeight: 1.3,
                      color: T.inkSoft,
                      marginTop: "0.5cqw",
                    }}
                  >
                    {b.detail}
                  </div>
                )}
              </div>
            </div>
          </Fade>
        ))}
      </div>
    </>
  );
}

/** Exported for tests and the editor: which beats are visible in a scene at `local`. */
export function visibleBeatIds(scene: Scene, timing: SceneTiming, local: number): string[] {
  return scene.beats
    .filter((_: Beat, k: number) => local >= timing.beats[k].start)
    .map((b) => b.id);
}
