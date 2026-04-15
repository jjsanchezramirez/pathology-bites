// Floating tool palette. Active tool is tracked in the editor store.
// Highlighted tools vary with the current slide's imageCategory.

"use client";

import { useEffect } from "react";
import {
  MousePointer2,
  Square,
  Egg,
  Flashlight,
  ArrowUpRight,
  Type,
  ZoomIn,
  Hand,
} from "lucide-react";
import { useEditorStore, type Tool } from "./model/store";
import { selectCurrentSlide } from "./model/store";
import type { ImageCategory } from "./model/types";

interface ToolDef {
  id: Tool;
  label: string;
  shortcut: string;
  Icon: typeof Square;
}

const TOOLS: ToolDef[] = [
  { id: "select", label: "Select", shortcut: "V", Icon: MousePointer2 },
  { id: "shape-rectangle", label: "Rectangle", shortcut: "R", Icon: Square },
  { id: "shape-oval", label: "Oval", shortcut: "O", Icon: Egg },
  { id: "spotlight", label: "Spotlight", shortcut: "S", Icon: Flashlight },
  { id: "arrow", label: "Arrow", shortcut: "A", Icon: ArrowUpRight },
  { id: "text", label: "Text", shortcut: "T", Icon: Type },
  { id: "zoom", label: "Zoom (camera)", shortcut: "Z", Icon: ZoomIn },
  { id: "pan", label: "Pan (camera)", shortcut: "P", Icon: Hand },
];

const MICROSCOPY_EMPHASIS: Tool[] = ["spotlight", "arrow", "shape-oval", "zoom", "pan"];
const PRESENTATION_EMPHASIS: Tool[] = ["text", "shape-rectangle", "arrow"];

function emphasisFor(cat?: ImageCategory): Tool[] {
  switch (cat) {
    case "microscopic":
    case "gross":
      return MICROSCOPY_EMPHASIS;
    case "figure":
    case "table":
    case "diagram":
      return PRESENTATION_EMPHASIS;
    default:
      return [];
  }
}

export function ToolPalette() {
  const tool = useEditorStore((s) => s.tool);
  const slide = useEditorStore(selectCurrentSlide);
  const setTool = useEditorStore((s) => s.setTool);
  const emphasis = emphasisFor(slide?.imageCategory);

  // Keyboard shortcuts.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore if user is typing in an input/textarea/contenteditable.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      const match = TOOLS.find((t) => t.shortcut.toLowerCase() === key);
      if (match) {
        e.preventDefault();
        setTool(match.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setTool]);

  return (
    <div className="pointer-events-auto absolute left-4 top-4 z-20 flex flex-col gap-1 rounded-md border bg-white/95 p-1 shadow-md backdrop-blur">
      {TOOLS.map((t) => {
        const active = tool === t.id;
        const emphasized = emphasis.includes(t.id);
        // Divider before the camera tools (zoom is the first camera tool).
        const showDivider = t.id === "zoom";
        return (
          <div key={t.id} className="flex flex-col gap-1">
            {showDivider && <div className="mx-1 my-1 h-px bg-gray-200" />}
            <button
              onClick={() => setTool(t.id)}
              title={`${t.label} (${t.shortcut})`}
              className={[
                "flex h-8 w-8 items-center justify-center rounded transition-colors",
                active
                  ? "bg-blue-600 text-white"
                  : emphasized
                    ? "text-blue-700 hover:bg-blue-50"
                    : "text-gray-700 hover:bg-gray-100",
              ].join(" ")}
            >
              <t.Icon className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
