// src/app/(dashboard)/dashboard/layout.tsx
import { Metadata } from "next"
import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client"
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context"

export const metadata: Metadata = {
  title: "Dashboard - Pathology Bites",
  description: "User dashboard for Pathology Bites learning platform",
}

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DashboardThemeProvider>
      <UnifiedLayoutClient
        userType="user"
        headerConfig={{
          showNotifications: true,
          showFontSize: true,
        }}
      >
        {children}
      </UnifiedLayoutClient>
    </DashboardThemeProvider>
  )
}