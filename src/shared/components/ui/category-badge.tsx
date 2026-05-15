import { Badge } from "@/shared/components/ui/badge";
import { getCategoryColor, type CategoryColorData } from "@/shared/utils/category-colors";
import { getCategoryStyle } from "@/shared/config/categories";
import { cn } from "@/shared/utils";

interface CategoryBadgeProps {
  category: CategoryColorData;
  label?: string;
  className?: string;
}

export function CategoryBadge({ category, label, className }: CategoryBadgeProps) {
  const color = getCategoryColor(category);
  const style = getCategoryStyle(color);
  const text = label ?? category.short_form ?? category.name ?? "";
  return (
    <Badge
      variant="outline"
      className={cn("text-xs border [&]:dark:brightness-90", className)}
      style={style?.light}
    >
      {text}
    </Badge>
  );
}
