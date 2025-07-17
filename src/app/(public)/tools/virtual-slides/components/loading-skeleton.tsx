// src/app/(public)/tools/virtual-slides/components/loading-skeleton.tsx

export function LoadingSkeleton() {
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
              <div className="h-3 bg-muted rounded animate-pulse w-1/2" />
            </div>
          </td>
          <td className="p-4">
            <div className="h-6 bg-muted rounded animate-pulse w-20" />
          </td>
          <td className="p-4">
            <div className="space-y-1">
              <div className="h-4 bg-muted rounded animate-pulse w-16" />
              <div className="h-3 bg-muted rounded animate-pulse w-12" />
            </div>
          </td>
          <td className="p-4">
            <div className="h-4 bg-muted rounded animate-pulse w-12" />
          </td>
          <td className="p-4">
            <div className="flex gap-2">
              <div className="h-8 bg-muted rounded animate-pulse w-20" />
              <div className="h-8 bg-muted rounded animate-pulse w-16" />
            </div>
          </td>
        </tr>
      ))}
    </tbody>
  )
}
