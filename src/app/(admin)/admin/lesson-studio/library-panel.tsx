// Library panel with three tabs: Images, SVGs, Blank.
// Click an image/SVG to add it; Blank tab just has an add-blank-slide button.
// Images come from /api/admin/library/images; SVGs come from the svg_assets table.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Search, ImageIcon, Shapes, Square } from "lucide-react";
import { useEditorStore, selectCurrentSlide } from "./model/store";
import {
  imageElementFromLibrary,
  blankSlide,
  svgElementFromAsset,
  type LibraryImageLike,
  type SvgAssetLike,
} from "./model/slide-factory";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 40;

export function LibraryPanel() {
  return (
    <div className="flex h-full w-[260px] flex-col border-r bg-muted/30">
      <div className="border-b p-2 text-xs font-semibold">Library</div>
      <Tabs defaultValue="images" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="m-2 grid grid-cols-3">
          <TabsTrigger value="images">
            <ImageIcon className="mr-1 h-3 w-3" />
            Images
          </TabsTrigger>
          <TabsTrigger value="svgs">
            <Shapes className="mr-1 h-3 w-3" />
            SVGs
          </TabsTrigger>
          <TabsTrigger value="blank">
            <Square className="mr-1 h-3 w-3" />
            Blank
          </TabsTrigger>
        </TabsList>
        <TabsContent value="images" className="flex-1 overflow-hidden">
          <ImagesTab />
        </TabsContent>
        <TabsContent value="svgs" className="flex-1 overflow-hidden">
          <SvgsTab />
        </TabsContent>
        <TabsContent value="blank" className="flex-1 overflow-hidden">
          <BlankTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Images tab -----------------------------------------------------------

function ImagesTab() {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<LibraryImageLike[]>([]);
  const [loading, setLoading] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slide = useEditorStore(selectCurrentSlide);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebounced(term), DEBOUNCE_MS);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [term]);

  function onAdd(img: LibraryImageLike) {
    if (!slide) return;
    const el = imageElementFromLibrary(img, slide.duration);
    useEditorStore.getState().addElement(slide.id, el);
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
        if (debounced) params.set("search", debounced);
        const res = await fetch(`/api/admin/library/images?${params}`);
        const data = await res.json();
        if (!cancelled) setItems(data.images ?? []);
      } catch (err) {
        console.error("[library] images load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  return (
    <div className="flex h-full flex-col">
      <div className="relative px-2 pb-2">
        <Search className="absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search images…"
          className="h-8 pl-6 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!slide ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Select a slide first</div>
        ) : loading && items.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No images</div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {items.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => onAdd(img)}
                className="group relative overflow-hidden rounded border bg-black hover:border-blue-500"
                title={img.description ?? ""}
              >
                <div style={{ aspectRatio: "16 / 9" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                </div>
                {img.category && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5 text-[9px] text-white truncate">
                    {img.category}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- SVGs tab -------------------------------------------------------------

function SvgsTab() {
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<SvgAssetLike[]>([]);
  const [loading, setLoading] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slide = useEditorStore(selectCurrentSlide);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => setDebounced(term), DEBOUNCE_MS);
    return () => {
      if (debRef.current) clearTimeout(debRef.current);
    };
  }, [term]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const { createClient } = await import("@/shared/services/client");
        const supabase = createClient();
        let q = supabase
          .from("svg_assets")
          .select("id, url, name, description, width, height")
          .order("created_at", { ascending: false })
          .limit(50);
        if (debounced) {
          q = q.or(`name.ilike.%${debounced}%,description.ilike.%${debounced}%`);
        }
        const { data } = await q;
        if (!cancelled) setItems(data ?? []);
      } catch (err) {
        console.error("[library] svgs load failed:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [debounced]);

  function onAdd(asset: SvgAssetLike) {
    if (!slide) return;
    const el = svgElementFromAsset(asset, slide.duration);
    useEditorStore.getState().addElement(slide.id, el);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative px-2 pb-2">
        <Search className="absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search SVGs…"
          className="h-8 pl-6 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {!slide ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Select a slide first</div>
        ) : loading && items.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="py-4 text-center text-xs text-muted-foreground">No SVGs</div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5">
            {items.map((asset) => (
              <button
                key={asset.id}
                type="button"
                onClick={() => onAdd(asset)}
                className="group relative overflow-hidden rounded border bg-white p-2 hover:border-blue-500"
                title={asset.name}
              >
                <div className="flex h-16 items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.name}
                    className="max-h-full max-w-full"
                    draggable={false}
                  />
                </div>
                <div className="mt-1 truncate text-[9px] text-gray-600">{asset.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Blank tab ------------------------------------------------------------

function BlankTab() {
  const addSlide = useEditorStore((s) => s.addSlide);
  const presets = useMemo(
    () => [
      { color: "#000000", label: "Black" },
      { color: "#ffffff", label: "White" },
      { color: "#0f172a", label: "Slate" },
      { color: "#1e3a8a", label: "Deep blue" },
      { color: "#064e3b", label: "Forest" },
      { color: "#7c2d12", label: "Brick" },
    ],
    []
  );
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="text-[10px] font-medium text-muted-foreground">Solid color</div>
      <div className="grid grid-cols-3 gap-1.5">
        {presets.map((p) => (
          <button
            key={p.color}
            type="button"
            onClick={() => addSlide(blankSlide(p.color))}
            className="flex flex-col items-center gap-1 rounded border bg-white p-1 hover:border-blue-500"
            title={`Add ${p.label} slide`}
          >
            <div className="h-10 w-full rounded border" style={{ background: p.color }} />
            <span className="text-[9px] text-gray-600">{p.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
