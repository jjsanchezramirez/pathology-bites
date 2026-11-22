// src/features/profile/components/profile-loading.tsx

import { PageHeader } from "@/shared/components/ui/page-header";
import { PageContainer, SectionCard } from "@/shared/components/ui/page-layout";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Separator } from "@/shared/components/ui/separator";
import { cn } from "@/shared/utils";

// Inline placeholder for SectionCard title/description slots (they render inside
// <h2>/<p>, so this must be a span rather than Skeleton's div).
function HeadingSkeleton({ className }: { className: string }) {
  return <span className={cn("block animate-pulse rounded-md bg-muted", className)} />;
}

function FieldSkeleton({ labelWidth = "w-20" }: { labelWidth?: string }) {
  return (
    <div className="space-y-2">
      <Skeleton className={cn("h-4", labelWidth)} />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

// Mirrors the loaded profile page: narrow container, header, then the
// Profile Information, Account Details and Password cards.
export function ProfileLoading() {
  return (
    <PageContainer width="narrow">
      <PageHeader
        title="My Profile"
        description="Manage your account information and preferences."
      />

      <div className="space-y-6">
        {/* Profile Information Card Skeleton */}
        <SectionCard
          title={<HeadingSkeleton className="h-5 w-44" />}
          description={<HeadingSkeleton className="h-4 w-64" />}
        >
          {/* First Name / Last Name Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldSkeleton />
            <FieldSkeleton />
          </div>
          {/* Institution */}
          <FieldSkeleton />
          {/* User Type */}
          <FieldSkeleton />
          {/* Email */}
          <FieldSkeleton labelWidth="w-12" />
          {/* Edit Button */}
          <Skeleton className="h-10 w-full" />
        </SectionCard>

        {/* Account Details Card Skeleton */}
        <SectionCard
          title={<HeadingSkeleton className="h-5 w-36" />}
          description={<HeadingSkeleton className="h-4 w-72 max-w-full" />}
        >
          <div className="space-y-3">
            {/* Role */}
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            {/* Status */}
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Separator />
            {/* User ID */}
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-64 max-w-[60%]" />
            </div>
            {/* Last Updated */}
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </SectionCard>

        {/* Password Change Card Skeleton */}
        <SectionCard
          title={<HeadingSkeleton className="h-5 w-40" />}
          description={<HeadingSkeleton className="h-4 w-56" />}
        >
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          {/* Change Password Button */}
          <Skeleton className="h-10 w-full" />
        </SectionCard>
      </div>
    </PageContainer>
  );
}
