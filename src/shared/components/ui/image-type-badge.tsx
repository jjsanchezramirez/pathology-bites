import { Badge } from "@/shared/components/ui/badge";
import { IMAGE_CATEGORIES, type ImageCategory } from "@/shared/types/images";
import { cn } from "@/shared/utils";

const IMAGE_TYPE_COLOR: Record<ImageCategory, string> = {
  microscopic: "border-green-300 bg-green-50 text-green-700",
  gross: "border-red-300 bg-red-50 text-red-700",
  figure: "border-purple-300 bg-purple-50 text-purple-700",
  table: "border-orange-300 bg-orange-50 text-orange-700",
  external: "border-gray-300 bg-gray-50 text-gray-700",
};

interface ImageTypeBadgeProps {
  category: ImageCategory | string;
  className?: string;
}

export function ImageTypeBadge({ category, className }: ImageTypeBadgeProps) {
  const color = IMAGE_TYPE_COLOR[category as ImageCategory] ?? IMAGE_TYPE_COLOR.external;
  const label = IMAGE_CATEGORIES[category as ImageCategory] ?? category;
  return (
    <Badge variant="outline" className={cn(color, className)}>
      {label}
    </Badge>
  );
}
