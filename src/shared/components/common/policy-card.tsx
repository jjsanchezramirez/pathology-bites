// src/shared/components/common/policy-card.tsx
import { Card } from "@/shared/components/ui/card"

interface PolicyCardProps {
  title: string
  children: React.ReactNode
}

export function PolicyCard({ title, children }: PolicyCardProps) {
  return (
    <Card className="p-8 shadow-lg">
      <h2 className="text-2xl font-bold mb-4">{title}</h2>
      <div className="space-y-4 text-muted-foreground">
        {children}
      </div>
    </Card>
  )
}

