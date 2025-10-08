// src/app/(admin)/admin/layout.tsx
import { Metadata } from "next"
import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client"
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context"
import { CacheDebug } from "@/shared/components/dev/cache-debug"

export const metadata: Metadata = {
  title: "Admin Dashboard - Pathology Bites",
  description: "Admin dashboard for managing Pathology Bites platform",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardThemeProvider>
      <UnifiedLayoutClient
        userType="admin"
        headerConfig={{
          showNotifications: true,
          showFontSize: true,
        }}
      >
        {children}
      </UnifiedLayoutClient>
      <CacheDebug />
    </DashboardThemeProvider>
  )
}