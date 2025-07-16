// src/components/dashboard/sidebar.tsx
"use client"

import { cn } from "@/shared/utils"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Plus, ClipboardList, BarChart2 } from "lucide-react"

import { SidebarAuthStatus } from "@/shared/components/layout/sidebar-auth-status"

interface SidebarProps {
  isOpen: boolean
}

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "New Quiz",
    href: "/dashboard/quiz/new",
    icon: Plus,
  },
  {
    title: "My Quizzes",
    href: "/dashboard/quizzes",
    icon: ClipboardList,
  },
  {
    title: "Performance",
    href: "/dashboard/performance",
    icon: BarChart2,
  },
]

export function Sidebar({}: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="p-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold">Pathology Bites</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="space-y-1 px-3">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-md text-sidebar-foreground/90 hover:bg-sidebar-foreground/10",
                isActive && "bg-sidebar-foreground/20"
              )}
            >
              <item.icon size={20} />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </nav>

      {/* Auth Status at Bottom */}
      <div className="shrink-0">
        <SidebarAuthStatus />
      </div>
    </div>
  )
}