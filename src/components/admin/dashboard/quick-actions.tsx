// src/components/admin/dashboard/quick-actions.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  ArrowRight,
  AlertCircle,
  Zap
} from "lucide-react"
import Link from "next/link"
import { QuickAction } from "@/lib/dashboard/service"

interface QuickActionsProps {
  actions: QuickAction[]
}

export function QuickActionsCard({ actions }: QuickActionsProps) {
  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {actions.map((action, index) => (
            <Link key={index} href={action.href}>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium">{action.title}</p>
                    {action.urgent && (
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                    )}
                    {action.count !== undefined && (
                      <Badge
                        variant={action.urgent ? "destructive" : "secondary"}
                        className="text-xs"
                      >
                        {action.count}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
