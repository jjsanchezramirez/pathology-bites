"use client";

import { useEffect, useState, type ComponentType } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer } from "@/shared/components/ui/page-layout";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Badge } from "@/shared/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { createClient } from "@/shared/services/client";
import { DEFAULT_MEDIA_TAB } from "../constants";

const loading = () => <Skeleton className="h-96 w-full" />;

// Client-only and code-split: each library is only downloaded when its tab is visible.
const ImagesTab = dynamic(() => import("./images-tab").then((m) => m.ImagesTab), {
  ssr: false,
  loading,
});
const AudioTab = dynamic(() => import("./audio-tab").then((m) => m.AudioTab), {
  ssr: false,
  loading,
});
const SvgTab = dynamic(() => import("./svg-tab").then((m) => m.SvgTab), {
  ssr: false,
  loading,
});

interface MediaCategory {
  /** URL value: /admin/media?tab=<id> */
  id: string;
  label: string;
  /** Table whose row count is shown on the tab. */
  table: "images" | "audio" | "svg_assets";
  Component: ComponentType;
}

/**
 * Every media library lives here. To add a category, add one entry (and its tab component);
 * the URL and tab follow from it. The whole page is admin-only (ADMIN_ONLY_PAGES in middleware).
 */
export const MEDIA_CATEGORIES: MediaCategory[] = [
  { id: "images", label: "Images", table: "images", Component: ImagesTab },
  { id: "audio", label: "Audio", table: "audio", Component: AudioTab },
  { id: "svg", label: "SVG", table: "svg_assets", Component: SvgTab },
];

export function MediaAdmin({ initialTab }: { initialTab: string }) {
  const router = useRouter();
  const [tab, setTab] = useState(initialTab);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const supabase = createClient();
    Promise.all(
      MEDIA_CATEGORIES.map(async (c) => {
        const { count } = await supabase.from(c.table).select("*", { count: "exact", head: true });
        return [c.id, count] as const;
      })
    ).then((rows) => setCounts(Object.fromEntries(rows.filter(([, n]) => typeof n === "number"))));
  }, []);

  // An unknown ?tab= falls back to the first tab.
  const active = MEDIA_CATEGORIES.some((c) => c.id === tab) ? tab : DEFAULT_MEDIA_TAB;

  const changeTab = (value: string) => {
    setTab(value);
    router.replace(value === DEFAULT_MEDIA_TAB ? "/admin/media" : `/admin/media?tab=${value}`, {
      scroll: false,
    });
  };

  return (
    <PageContainer>
      <PageHeader
        title="Media"
        description="Images, audio and vector graphics used across the site."
      />

      <Tabs value={active} onValueChange={changeTab} className="space-y-6">
        <TabsList>
          {MEDIA_CATEGORIES.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="gap-2">
              {c.label}
              {counts[c.id] !== undefined && (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {counts[c.id].toLocaleString()}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {MEDIA_CATEGORIES.map(({ id, Component }) => (
          <TabsContent key={id} value={id} className="space-y-6">
            <Component />
          </TabsContent>
        ))}
      </Tabs>
    </PageContainer>
  );
}
