// src/shared/components/ui/page-layout.tsx
// Layout primitives for admin (and dashboard) pages. One spacing + type scale,
// so every page lines up the same way at every breakpoint:
//
//   Spacing   page sections  space-y-6   (PageContainer)
//             inside a card  space-y-4   (SectionCard body)
//             grids          gap-4       (StatGrid, ContentGrid)
//             inline groups  gap-2
//   Padding   cards          p-4 sm:p-6  (header + body)
//             table cells    px-4 py-3   (Table primitives)
//   Type      page title     text-2xl sm:text-3xl bold      (PageHeader)
//             section title  text-lg semibold               (SectionCard, PageSection)
//             stat label     text-sm medium muted           (StatCard)
//             stat value     text-2xl bold tabular-nums     (StatCard)
//             body           text-sm
//             meta           text-xs text-muted-foreground
//
// See docs/admin-ui.md for when to reach for each piece.

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

import { cn } from "@/shared/utils";

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

interface PageContainerProps {
  children: ReactNode;
  /** `narrow` caps the width for forms and settings-style pages. */
  width?: "default" | "narrow";
  className?: string;
}

/** Vertical stack of page sections. The shell already supplies padding + max width. */
export function PageContainer({ children, width = "default", className }: PageContainerProps) {
  return (
    <div className={cn("space-y-6", width === "narrow" && "mx-auto w-full max-w-4xl", className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

interface SectionHeadingProps {
  title?: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  actions?: ReactNode;
}

function SectionHeading({ title, description, icon: Icon, actions }: SectionHeadingProps) {
  if (!title && !description && !actions) return null;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        {title && (
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-tight tracking-tight">
            {Icon && <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />}
            <span className="min-w-0">{title}</span>
          </h2>
        )}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

interface PageSectionProps extends SectionHeadingProps {
  children: ReactNode;
  className?: string;
}

/** Titled group of content that is not itself a card (e.g. a heading over a grid). */
export function PageSection({ children, className, ...heading }: PageSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      <SectionHeading {...heading} />
      {children}
    </section>
  );
}

interface SectionCardProps extends SectionHeadingProps {
  children?: ReactNode;
  className?: string;
  /** Classes for the body wrapper. */
  contentClassName?: string;
  /**
   * Drop body padding so a table / list can run edge to edge. The header (if any)
   * keeps its padding and gets a bottom border.
   */
  flush?: boolean;
  /** Optional footer row (pagination, form actions). */
  footer?: ReactNode;
}

/** The standard admin card: optional heading row, padded body, optional footer. */
export function SectionCard({
  children,
  className,
  contentClassName,
  flush = false,
  footer,
  ...heading
}: SectionCardProps) {
  const hasHeading = Boolean(heading.title || heading.description || heading.actions);
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-xs",
        className
      )}
    >
      {hasHeading && (
        <div className={cn("p-4 sm:p-6", flush ? "border-b" : "pb-0 sm:pb-0")}>
          <SectionHeading {...heading} />
        </div>
      )}
      {children !== undefined && children !== null && (
        <div className={cn("min-w-0 flex-1", !flush && "space-y-4 p-4 sm:p-6", contentClassName)}>
          {children}
        </div>
      )}
      {footer && <div className="border-t px-4 py-3 sm:px-6">{footer}</div>}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Grids                                                               */
/* ------------------------------------------------------------------ */

// Stats are short, so they pair up even on phones; full-width stat cards
// turn a dashboard into a long scroll.
const STAT_COLS = {
  2: "grid-cols-2",
  3: "grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
} as const;

interface GridProps {
  children: ReactNode;
  columns?: keyof typeof STAT_COLS;
  className?: string;
}

/** Row of StatCards. 2 columns on phones and tablets, widening at `lg`. */
export function StatGrid({ children, columns = 4, className }: GridProps) {
  return <div className={cn("grid gap-4", STAT_COLS[columns], className)}>{children}</div>;
}

const CONTENT_COLS = {
  2: "grid-cols-1 lg:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-4",
} as const;

/** Grid of SectionCards. Stays single-column until there is room for real content. */
export function ContentGrid({ children, columns = 2, className }: GridProps) {
  return <div className={cn("grid gap-4", CONTENT_COLS[columns], className)}>{children}</div>;
}

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */

const STAT_TONES = {
  default: { icon: "text-muted-foreground", value: "" },
  success: { icon: "text-emerald-600 dark:text-emerald-400", value: "" },
  warning: { icon: "text-amber-600 dark:text-amber-400", value: "" },
  danger: { icon: "text-red-600 dark:text-red-400", value: "text-red-600 dark:text-red-400" },
  info: { icon: "text-blue-600 dark:text-blue-400", value: "" },
} as const;

export type StatTone = keyof typeof STAT_TONES;

interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  /** Small line under the value (trend, context). */
  hint?: ReactNode;
  tone?: StatTone;
  className?: string;
  /** Extra content under the hint (progress bar, mini breakdown). */
  children?: ReactNode;
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  className,
  children,
}: StatCardProps) {
  const t = STAT_TONES[tone];
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-4 text-card-foreground shadow-xs sm:p-6",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4 shrink-0", t.icon)} />}
      </div>
      <div className={cn("text-2xl font-bold tabular-nums leading-none", t.value)}>{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      {children}
    </div>
  );
}

/** Loading placeholder with the exact footprint of a StatCard. */
export function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-4 shadow-xs sm:p-6",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="h-4 w-4 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-6 w-16 animate-pulse rounded bg-muted" />
      <div className="h-3 w-32 animate-pulse rounded bg-muted" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

interface TableShellProps {
  children: ReactNode;
  /** Pagination / summary row under the table. */
  footer?: ReactNode;
  className?: string;
}

/** Bordered, horizontally-scrollable frame for a <Table>. */
export function TableShell({ children, footer, className }: TableShellProps) {
  return (
    <div className={cn("min-w-0 overflow-hidden rounded-lg border bg-card", className)}>
      {children}
      {footer && <div className="border-t px-4 py-3">{footer}</div>}
    </div>
  );
}

/** Wraps a toolbar row (search, filters, actions) above a table or grid. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:min-w-0",
        className
      )}
    >
      {children}
    </div>
  );
}
