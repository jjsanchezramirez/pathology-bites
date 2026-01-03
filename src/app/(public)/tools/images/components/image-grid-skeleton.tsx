export function ImageGridSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {Array.from({ length: 20 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="w-full aspect-square bg-muted animate-pulse rounded-lg" />
          <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
        </div>
      ))}
    </div>
  );
}
