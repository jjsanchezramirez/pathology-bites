// src/shared/components/ui/empty-state.tsx
// Generic empty state for tables, lists, and search results.

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/shared/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Slot for a call-to-action button/link. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      {Icon && <Icon className="h-10 w-10 text-muted-foreground/50 mb-4" />}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
