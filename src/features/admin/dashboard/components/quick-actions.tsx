"use client";

// src/shared/components/layout/dashboard/quick-actions.tsx
import { SectionCard } from "@/shared/components/ui/page-layout";
import { Badge } from "@/shared/components/ui/badge";
import { ArrowRight, AlertCircle, Zap } from "lucide-react";
import Link from "next/link";
import { QuickAction } from "@/features/admin/dashboard/services/service";
import { useUserRole } from "@/shared/hooks/use-user-role";

interface QuickActionsProps {
  actions: QuickAction[];
}

export function QuickActionsCard({ actions }: QuickActionsProps) {
  const { isAdmin, canAccess } = useUserRole();

  // Filter actions based on user permissions
  const filteredActions = actions.filter((action) => {
    if (action.adminOnly && !isAdmin) return false;
    if (action.permission && !canAccess(action.permission)) return false;
    return true;
  });

  return (
    <SectionCard title="Quick Actions" icon={Zap}>
      <div className="space-y-2">
        {filteredActions.map((action, index) => (
          <Link key={index} href={action.href} className="block">
            <div className="group flex cursor-pointer items-center justify-between gap-2 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-0 truncate text-sm font-medium">{action.title}</p>
                  {action.urgent && <AlertCircle className="h-4 w-4 shrink-0 text-orange-500" />}
                  {action.count !== undefined && (
                    <Badge
                      variant={action.urgent ? "destructive" : "secondary"}
                      className="text-xs"
                    >
                      {action.count}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{action.description}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </SectionCard>
  );
}
