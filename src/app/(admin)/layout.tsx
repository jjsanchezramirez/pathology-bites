// src/app/(admin)/layout.tsx
import { Metadata } from "next"
import { cookies } from "next/headers"
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs"
import { redirect } from "next/navigation"
import { AdminLayoutClient } from "@/components/admin/layout-client"

export const metadata: Metadata = {
  title: "Admin Dashboard - Pathology Bites",
  description: "Admin dashboard for managing Pathology Bites platform",
}

async function AdminLayoutServer() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  if (session?.user?.id) {
    const { data: user } = await supabase
      .from("users")
      .select("role")
      .eq("id", session.user.id)
      .single()

    if (user?.role !== "admin") {
      redirect("/dashboard")
    }
  } else {
    redirect("/login")
  }

  return null
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await AdminLayoutServer()
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}