// src/shared/components/layout/unified-sidebar.tsx
'use client'

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Microscope,
  LayoutDashboard,
  FileQuestion,
  ClipboardList,
  Tags,
  Users,
  Image,
  BarChart,
  MessageSquare,
  Settings,
  Plus,
  BarChart2,
  BookOpen,
  Target,
  TrendingUp,
  User,
  Brain,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/shared/utils"
import { SidebarAuthStatus } from "@/shared/components/layout/sidebar-auth-status"
import { NavigationItem, filterNavigationItems } from "@/shared/config/navigation"
import { useUserRole } from "@/shared/hooks/use-user-role"

// Icon mapping for string identifiers to actual components
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  FileQuestion,
  ClipboardList,
  Tags,
  Users,
  Image,
  BarChart,
  MessageSquare,
  Settings,
  Plus,
  BarChart2,
  BookOpen,
  Target,
  TrendingUp,
  User,
  Brain,
  Microscope,
}

interface UnifiedSidebarProps {
  isCollapsed: boolean
  navigationItems: NavigationItem[]
  isMobileMode?: boolean
}

export function UnifiedSidebar({ isCollapsed, navigationItems, isMobileMode = false }: UnifiedSidebarProps) {
  const pathname = usePathname()
  const { canAccess, isAdmin, isLoading } = useUserRole()

  // Filter navigation items based on user permissions
  const filteredNavigation = filterNavigationItems(
    navigationItems,
    canAccess,
    isAdmin,
    isLoading
  )

  return (
    <aside
      className={`${
        isMobileMode ? '' : 'fixed left-0 top-0 z-50'
      } ${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 border-r border-sidebar-border`}
      style={{
        height: '100dvh', // Use dynamic viewport height for mobile browsers
        minHeight: '100vh', // Fallback for browsers that don't support dvh
      }}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center px-6 border-b border-sidebar-border shrink-0">
        <Microscope className="h-6 w-6 shrink-0" style={{ marginLeft: '-4px' }} />
        {!isCollapsed && (
          <h1 className="font-bold text-lg ml-3 whitespace-nowrap">Pathology Bites</h1>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-1">
          {filteredNavigation.map((item, index) => {
            const isActive = pathname === item.href
            const IconComponent = iconMap[item.icon] || LayoutDashboard // Fallback to LayoutDashboard

            return (
              <div key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center px-3 h-10 rounded-md text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 transition-colors",
                    isActive && "bg-sidebar-foreground/20 text-sidebar-foreground"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  {/* Same pattern as logo - icon stays in same position, text appears/disappears */}
                  <IconComponent className="h-5 w-5 shrink-0" style={{ marginLeft: '-1px' }} />
                  {!isCollapsed && (
                    <span className="truncate ml-3">{item.name}</span>
                  )}
                  {!isCollapsed && item.adminOnly && !isAdmin && !isLoading && (
                    <span className="ml-auto text-xs text-sidebar-foreground/50">Admin</span>
                  )}
                </Link>
              </div>
            )
          })}
        </div>
      </nav>

      {/* Auth Status at Bottom */}
      <div className="mt-auto border-t border-sidebar-border">
        <SidebarAuthStatus isCollapsed={isCollapsed} />
      </div>
    </aside>
  )
}
