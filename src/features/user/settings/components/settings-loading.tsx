"use client";

import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer, SectionCard } from "@/shared/components/ui/page-layout";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Separator } from "@/shared/components/ui/separator";
import { cn } from "@/shared/utils";

// Inline placeholder for SectionCard title/description slots (they render inside
// <h2>/<p>, so this must be a span rather than Skeleton's div).
function HeadingSkeleton({ className }: { className: string }) {
  return <span className={cn("block max-w-full animate-pulse rounded-md bg-muted", className)} />;
}

/** Label + helper text + full-width control, like the Select rows in the real cards. */
function SelectRowSkeleton({ helper = true }: { helper?: boolean }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      {helper && <Skeleton className="h-4 w-56 max-w-full" />}
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

/** Label + helper text + small button, like the action rows (export, reset, delete). */
function ActionRowSkeleton({ buttonWidth = "w-36" }: { buttonWidth?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className={cn("h-9", buttonWidth)} />
    </div>
  );
}

// Mirrors the loaded settings page: narrow container, header, then each card
// in the same order with the same primitives.
export function SettingsLoading() {
  return (
    <PageContainer width="narrow">
      <PageHeader
        title="Settings"
        description="Manage your account preferences and quiz settings."
      />

      <div className="space-y-6">
        {/* Appearance Settings Skeleton */}
        <SectionCard
          title={<HeadingSkeleton className="h-5 w-32" />}
          description={<HeadingSkeleton className="h-4 w-64" />}
        >
          <SelectRowSkeleton />
          <Separator />
          <SelectRowSkeleton />
          <Separator />
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-56 max-w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="mx-auto h-3 w-28" />
          </div>
        </SectionCard>

        {/* Notification Settings Skeleton */}
        <SectionCard
          title={<HeadingSkeleton className="h-5 w-36" />}
          description={<HeadingSkeleton className="h-4 w-72" />}
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-4">
              {i > 0 && <Separator />}
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-48 max-w-full" />
                </div>
                <Skeleton className="h-6 w-11 shrink-0 rounded-full" />
              </div>
            </div>
          ))}
        </SectionCard>

        {/* Quiz Settings Skeleton */}
        <SectionCard
          title={<HeadingSkeleton className="h-5 w-28" />}
          description={<HeadingSkeleton className="h-4 w-64" />}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-4">
              {i > 0 && <Separator />}
              <SelectRowSkeleton helper={false} />
            </div>
          ))}
        </SectionCard>

        {/* Privacy & Security Skeleton */}
        <SectionCard
          title={<HeadingSkeleton className="h-5 w-40" />}
          description={<HeadingSkeleton className="h-4 w-64" />}
        >
          <ActionRowSkeleton />
        </SectionCard>

        {/* Reset Settings Skeleton */}
        <SectionCard
          title={<HeadingSkeleton className="h-5 w-32" />}
          description={<HeadingSkeleton className="h-4 w-72" />}
        >
          <ActionRowSkeleton />
        </SectionCard>

        {/* Danger Zone Skeleton */}
        <SectionCard
          className="border-red-200 dark:border-red-800"
          title={<HeadingSkeleton className="h-5 w-24" />}
          description={<HeadingSkeleton className="h-4 w-80" />}
        >
          <ActionRowSkeleton buttonWidth="w-32" />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
