// src/shared/components/ui/page-header.tsx
// Standard page heading block used across admin + dashboard pages.
// Stacks title and actions on phones; side by side from `sm` up.

import { ReactNode } from "react";

import { cn } from "@/shared/utils";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned slot for actions (buttons, filters). Wraps on narrow screens. */
  actions?: ReactNode;
  /** Small element rendered above the title (back link, breadcrumb). */
  eyebrow?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, eyebrow, className }: PageHeaderProps) {
  return (
    <div
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" suppressHydrationWarning>
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground sm:text-base" suppressHydrationWarning>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
