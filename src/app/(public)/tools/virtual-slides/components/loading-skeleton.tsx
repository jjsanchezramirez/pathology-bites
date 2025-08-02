// src/app/(public)/tools/virtual-slides/components/loading-skeleton.tsx

interface LoadingSkeletonProps {
  variant?: 'table' | 'cards'
}

export function LoadingSkeleton({ variant = 'cards' }: LoadingSkeletonProps) {
  if (variant === 'table') {
    return (
      <tbody>
        {Array.from({ length: 10 }, (_, i) => (
          <tr key={i} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
            <td className="p-4">
              <div className="w-16 h-16 bg-muted rounded-lg animate-pulse" />
            </td>
            <td className="p-4">
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/2 md:hidden" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/3 md:hidden" />
                <div className="h-3 bg-muted rounded animate-pulse w-2/3 hidden md:block lg:hidden" />
                <div className="h-3 bg-muted rounded animate-pulse w-2/3 hidden lg:block" />
              </div>
            </td>
            <td className="p-4 hidden lg:table-cell">
              <div className="h-6 bg-muted rounded animate-pulse w-20" />
            </td>
            <td className="p-4 hidden md:table-cell">
              <div className="space-y-1">
                <div className="h-4 bg-muted rounded animate-pulse w-16" />
                <div className="h-3 bg-muted rounded animate-pulse w-12" />
              </div>
            </td>
            <td className="p-4 hidden lg:table-cell">
              <div className="h-4 bg-muted rounded animate-pulse w-12" />
            </td>
            <td className="p-4">
              <div className="md:hidden">
                <div className="h-8 w-8 bg-muted rounded animate-pulse" />
              </div>
              <div className="hidden md:flex lg:hidden gap-2">
                <div className="h-8 bg-muted rounded animate-pulse w-12" />
                <div className="h-8 bg-muted rounded animate-pulse w-12" />
              </div>
              <div className="hidden lg:flex gap-2">
                <div className="h-8 bg-muted rounded animate-pulse w-20" />
                <div className="h-8 bg-muted rounded animate-pulse w-16" />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    )
  }

  // Cards variant for loading states outside of tables
  return (
    <div className="space-y-4">
      {/* Search and filters skeleton */}
      <div className="space-y-4">
        <div className="h-10 bg-muted rounded animate-pulse" />
        <div className="flex flex-wrap gap-2">
          <div className="h-8 bg-muted rounded animate-pulse w-24" />
          <div className="h-8 bg-muted rounded animate-pulse w-32" />
          <div className="h-8 bg-muted rounded animate-pulse w-28" />
        </div>
      </div>

      {/* Results skeleton */}
      <div className="space-y-2">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="border rounded-lg p-4 bg-card">
            <div className="flex gap-4">
              <div className="w-16 h-16 bg-muted rounded-lg animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
                <div className="h-3 bg-muted rounded animate-pulse w-2/3" />
              </div>
              <div className="flex gap-2">
                <div className="h-8 bg-muted rounded animate-pulse w-16" />
                <div className="h-8 bg-muted rounded animate-pulse w-12" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
