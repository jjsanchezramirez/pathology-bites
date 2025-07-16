// src/components/admin/sidebar.tsx
'use client'

import {
  LayoutDashboard,
  Users,
  FileQuestion,
  BarChart,
  Image,
  Settings,
  Microscope,
  Tags,
  MessageSquare,
  ClipboardCheck,
  ClipboardList,
  Flag
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SidebarAuthStatus } from "./sidebar-auth-status"
import { useUserRole } from "@/shared/hooks/use-user-role"

const navigation = [
  {
    name: "Dashboard",
    href: "/admin/dashboard",
    icon: LayoutDashboard,
    requiredPermission: "dashboard.view"
  },
  {
    name: "All Questions",
    href: "/admin/questions",
    icon: FileQuestion,
    requiredPermission: "questions.view"
  },
  {
    name: "My Questions",
    href: "/admin/my-questions",
    icon: FileQuestion,
    requiredPermission: "questions.create"
  },
  {
    name: "Review Queue",
    href: "/admin/review-queue",
    icon: ClipboardList,
    requiredPermission: "questions.review"
  },
  {
    name: "Tags, Sets & Categories",
    href: "/admin/question-management",
    icon: Tags,
    requiredPermission: "categories.manage",
    adminOnly: true
  },
  {
    name: "Users",
    href: "/admin/users",
    icon: Users,
    requiredPermission: "users.manage",
    adminOnly: true
  },
  {
    name: "Images",
    href: "/admin/images",
    icon: Image,
    requiredPermission: "images.manage",
    adminOnly: true
  },
  {
    name: "Analytics",
    href: "/admin/analytics",
    icon: BarChart,
    requiredPermission: "analytics.view",
    adminOnly: true
  },
  {
    name: "Inquiries",
    href: "/admin/inquiries",
    icon: MessageSquare,
    requiredPermission: "inquiries.manage",
    adminOnly: true
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings,
    requiredPermission: "settings.manage",
    adminOnly: true
  }
]

interface SidebarProps {
  isCollapsed: boolean;
}

export function AdminSidebar({ isCollapsed }: SidebarProps) {
  const pathname = usePathname()
  const { canAccess, isAdmin, isLoading } = useUserRole()

  // Filter navigation items based on user permissions
  const filteredNavigation = navigation.filter(item => {
    if (isLoading) return true // Show all items while loading
    if (item.adminOnly && !isAdmin) return false
    if (item.requiredPermission && !canAccess(item.requiredPermission)) return false
    return true
  })

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-50 ${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 border-r border-sidebar-border`}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
        <Microscope className="h-6 w-6 shrink-0" />
        {!isCollapsed && (
          <h1 className="font-bold text-lg ml-3 whitespace-nowrap">Pathology Bites</h1>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-1 px-3 flex flex-col h-full">
          <div className="flex-1 space-y-1">
            {filteredNavigation.map((item) => {
              const isActive = pathname === item.href
              const hasPermission = !item.requiredPermission || canAccess(item.requiredPermission)
              const isDisabled = !hasPermission && !isLoading

              return (
                <Link
                  key={item.name}
                  href={isDisabled ? '#' : item.href}
                  className={`flex h-10 rounded-lg text-sm font-medium
                    transition-colors duration-200 relative items-center
                    ${isDisabled
                      ? 'text-sidebar-foreground/30 cursor-not-allowed opacity-50'
                      : isActive
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                        : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}
                  title={isCollapsed ? item.name : undefined}
                  onClick={isDisabled ? (e) => e.preventDefault() : undefined}
                >
                  <div className="flex items-center justify-center w-10 shrink-0">
                    <item.icon className="h-5 w-5" />
                  </div>
                  {!isCollapsed && (
                    <span className="truncate">{item.name}</span>
                  )}
                  {!isCollapsed && item.adminOnly && !isAdmin && !isLoading && (
                    <span className="ml-auto text-xs text-sidebar-foreground/50">Admin</span>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Auth Status as Navigation Item */}
          <SidebarAuthStatus isCollapsed={isCollapsed} />
        </div>
      </nav>
    </aside>
  )
}