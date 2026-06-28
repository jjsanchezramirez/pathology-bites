import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";

export function EditQuestionSkeleton() {
  return (
    <div className="space-y-6">
      {/* Status Badge Skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-6 w-32" />
      </div>

      {/* Tab Navigation Skeleton */}
      <Card className="overflow-hidden">
        <div className="border-b bg-muted/50 px-6 py-3">
          <div className="flex gap-4">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-28" />
          </div>
        </div>

        {/* Form Content Skeleton */}
        <div className="p-6 space-y-6">
          {/* Question Title */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Question Stem */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-32 w-full" />
          </div>

          {/* Options */}
          <div className="space-y-4">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </Card>
    </div>
  );
}
