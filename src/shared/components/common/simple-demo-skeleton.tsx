'use client'

import { Card, CardContent, CardHeader } from "@/shared/components/ui/card"

export function SimpleDemoSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card className="min-h-[600px]">
        <CardHeader>
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Question text skeleton */}
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-1/2" />
          </div>

          {/* Image skeleton */}
          <div className="h-64 bg-gray-200 rounded animate-pulse" />

          {/* Options skeleton */}
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
