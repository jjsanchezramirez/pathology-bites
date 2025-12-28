// src/app/(admin)/admin/layout.tsx
'use client'

import { UnifiedLayoutClient } from "@/shared/components/layout/unified-layout-client"
import { DashboardSettingsProvider } from "@/shared/contexts/dashboard-settings-provider"
import { DashboardThemeProvider } from "@/shared/contexts/dashboard-theme-context"
import { AuthGuard } from "@/shared/components/auth/auth-guard"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AuthGuard>
      <DashboardSettingsProvider>
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
        </DashboardThemeProvider>
      </DashboardSettingsProvider>
    </AuthGuard>
  )
}