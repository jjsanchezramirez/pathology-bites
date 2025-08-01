// src/app/(admin)/admin/settings/page.tsx
import { Metadata } from "next"
import { SettingsForm } from "@/features/admin/components/settings-form"

export const metadata: Metadata = {
  title: "Settings - Admin Dashboard",
  description: "Configure system settings and preferences",
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure system settings and preferences for the platform.
        </p>
      </div>

      <SettingsForm />
    </div>
  )
}
