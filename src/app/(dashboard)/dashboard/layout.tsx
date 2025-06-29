// src/app/(dashboard)/layout.tsx
import { Metadata } from "next"
import { DashboardLayoutClient } from "@/features/dashboard/components/dashboard-layout-client"

export const metadata: Metadata = {
  title: "Dashboard - Pathology Bites",
  description: "User dashboard for Pathology Bites learning platform",
}

export default function DashboardLayoutWrapper({
  children,
}: {
  children: React.ReactNode
}) {
  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}