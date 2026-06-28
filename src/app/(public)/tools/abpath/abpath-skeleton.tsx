import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";

export function ABPathSkeleton() {
  return (
    <section className="flex-1 py-12">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="space-y-6">
          {/* Controls Skeleton */}
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              {/* Search skeleton */}
              <div className="relative min-w-[200px] flex-1 max-w-sm">
                <div className="h-10 bg-muted rounded-md animate-pulse" />
              </div>

              {/* Category filter skeleton */}
              <div className="w-[280px]">
                <div className="h-10 bg-muted rounded-md animate-pulse" />
              </div>

              {/* Toggle buttons skeleton */}
              <div className="flex gap-1">
                <div className="h-8 w-12 bg-muted rounded-md animate-pulse" />
                <div className="h-8 w-12 bg-muted rounded-md animate-pulse" />
              </div>

              <div className="flex gap-1">
                <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
                <div className="h-8 w-12 bg-muted rounded-md animate-pulse" />
                <div className="h-8 w-16 bg-muted rounded-md animate-pulse" />
              </div>

              {/* Export button skeleton */}
              <div className="h-8 w-24 bg-muted rounded-md animate-pulse" />
            </div>
          </Card>

          {/* Statistics Skeleton */}
          <Card className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-center">
              {[...Array(6)].map((_, i) => (
                <div key={i}>
                  <div className="h-8 w-12 bg-muted rounded mx-auto mb-2 animate-pulse" />
                  <div className="h-3 w-16 bg-muted rounded mx-auto animate-pulse" />
                </div>
              ))}
            </div>
          </Card>

          {/* Results Skeleton */}
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-16 bg-muted rounded animate-pulse" />
                    <div className="h-5 w-64 bg-muted rounded animate-pulse" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[...Array(3)].map((_, j) => (
                      <div key={j} className="space-y-2">
                        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
                        <div className="ml-4 space-y-1">
                          <div className="h-3 w-full bg-muted rounded animate-pulse" />
                          <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
