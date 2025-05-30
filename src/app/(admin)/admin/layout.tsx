// src/app/(admin)/layout.tsx
import { Metadata } from "next"
import { AdminLayoutClient } from "@/shared/components/layout/layout-client"

export const metadata: Metadata = {
  title: "Admin Dashboard - Pathology Bites",
  description: "Admin dashboard for managing Pathology Bites platform",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}