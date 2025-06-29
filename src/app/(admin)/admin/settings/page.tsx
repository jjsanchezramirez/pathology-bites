// src/app/(admin)/admin/settings/page.tsx
import { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { SettingsForm } from "@/features/admin/components/settings-form"

export const metadata: Metadata = {
  title: "Settings - Admin Dashboard",
  description: "Configure system settings and preferences",
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure system settings and preferences for the platform
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Configuration</CardTitle>
          <CardDescription>
            Manage general settings, notifications, and system preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsForm />
        </CardContent>
      </Card>
    </div>
  )
}
