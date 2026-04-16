"use client";

import { ImageCarousel } from "@/shared/components/media/image-carousel";
import { ImageSection as ImageSectionType } from "../../types";

interface ImageSectionProps {
  section: ImageSectionType;
  images: { id: string; url: string; alt_text: string | null }[];
}

export function ImageSection({ section, images }: ImageSectionProps) {
  const sectionImages = section.imageIds
    .map((id) => images.find((img) => img.id === id))
    .filter(Boolean) as { id: string; url: string; alt_text: string | null }[];

  if (sectionImages.length === 0) return null;

  return (
    <div className="space-y-2">
      {section.heading && <h2 className="text-2xl font-bold tracking-tight">{section.heading}</h2>}
      <ImageCarousel
        images={sectionImages.map((img) => ({
          url: img.url,
          alt: img.alt_text || "Lesson image",
        }))}
      />
      {section.caption && (
        <p className="text-sm text-muted-foreground italic text-center">{section.caption}</p>
      )}
    </div>
  );
}
