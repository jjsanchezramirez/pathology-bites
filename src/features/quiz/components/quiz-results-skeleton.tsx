import { Card, CardContent, CardHeader } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"

export function QuizResultsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header Skeleton */}
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-48 mx-auto" />
        <Skeleton className="h-6 w-32 mx-auto" />
      </div>

      {/* Main Score Display Skeleton */}
      <Card className="text-center">
        <CardContent className="pt-8 pb-6">
          {/* Circular Progress Skeleton */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <Skeleton className="h-40 w-40 rounded-full" />
              {/* Inner percentage text skeleton */}
              <div className="absolute inset-0 flex items-center justify-center">
                <Skeleton className="h-8 w-16" />
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-7 w-64 mx-auto" />
            <Skeleton className="h-5 w-48 mx-auto" />
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-2">
                <Skeleton className="h-6 w-6 rounded" />
              </div>
              <Skeleton className="h-8 w-8 mx-auto mb-1" />
              <Skeleton className="h-4 w-16 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Breakdown Skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2 w-24 rounded-full" />
                  <Skeleton className="h-4 w-8" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons Skeleton */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}
