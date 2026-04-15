// Library panel with two tabs: Images and SVGs.
// Click an image/SVG to add it to the current slide; drag an image to add as overlay.

"use client";

import { useEffect, useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Input } from "@/shared/components/ui/input";
import { Search, ImageIcon, Shapes } from "lucide-react";
import { useEditorStore, selectCurrentSlide } from "./model/store";
import {
  imageElementFromLibrary,
  svgElementFromAsset,
  type LibraryImageLike,
  type SvgAssetLike,
} from "./model/slide-factory";

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 20;

export function LibraryPanel() {
  return (
    <div className="flex h-full w-[260px] flex-col border-r bg-muted/30">
      <div className="border-b p-2 text-xs font-semibold">Library</div>
      <Tabs defaultValue="images" className="flex flex-1 flex-col overflow-hidden">
        <TabsList className="m-2 grid grid-cols-2">
          <TabsTrigger value="images">
            <ImageIcon className="mr-1 h-3 w-3" />
            Images
          </TabsTrigger>
          <TabsTrigger value="svgs">
            <Shapes className="mr-1 h-3 w-3" />
            SVGs
          </TabsTrigger>
        </TabsList>
        <TabsContent value="images" className="flex-1 overflow-hidden">
          <ImagesTab />
        </TabsContent>
        <TabsContent value="svgs" className="flex-1 overflow-hidden">
          <SvgsTab />
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
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/x-library-image", JSON.stringify(img));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="group relative overflow-hidden rounded border bg-black hover:border-blue-500"
                title={img.description ?? ""}
              >
                <div style={{ aspectRatio: "16 / 9" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                </div>
                <div className="truncate bg-black/40 px-1 py-0.5 text-[10px] font-medium text-white">
                  {img.description ?? ""}
                </div>
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
          .limit(20);
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
                    loading="lazy"
                    decoding="async"
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
