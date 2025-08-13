"use client"

import { useClientVirtualSlides } from '@/shared/hooks/use-client-virtual-slides'

export function VirtualSlidesUltraMinimal() {
  const client = useClientVirtualSlides(20)

  if (client.isLoading) return <div className="p-4">Loading…</div>
  if (client.error) return <div className="p-4 text-red-600">{client.error}</div>

  return (
    <div className="p-4">
      <div className="text-sm text-muted-foreground mb-2">
        {client.totalResults} results
      </div>
      <ul className="list-disc pl-6 space-y-1">
        {client.slides.map(s => (
          <li key={s.id} className="text-sm">
            {s.diagnosis}
          </li>
        ))}
      </ul>
    </div>
  )
}

