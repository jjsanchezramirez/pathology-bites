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
  FolderOpen,
  Clock,
  Layers,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/shared/utils"
import { SidebarAuthStatus } from "@/shared/components/layout/sidebar-auth-status"
import { NavigationItem, NavigationSection, filterNavigationItems, filterNavigationSections } from "@/shared/config/navigation"
import { useUserRole } from "@/shared/hooks/use-user-role"
import { useDashboardTheme } from "@/shared/contexts/dashboard-theme-context"
import { usePendingInquiriesCount } from "@/shared/hooks/use-pending-inquiries-count"

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
  FolderOpen,
  Clock,
  Layers,
}

interface UnifiedSidebarProps {
  isCollapsed: boolean
  navigationItems?: NavigationItem[]
  navigationSections?: NavigationSection[]
  isMobileMode?: boolean
}

export function UnifiedSidebar({ isCollapsed, navigationItems, navigationSections, isMobileMode = false }: UnifiedSidebarProps) {
  const pathname = usePathname()
  const { canAccess, isAdmin, isLoading } = useUserRole()
  const { adminMode, isTransitioning } = useDashboardTheme()
  const { count: pendingInquiriesCount } = usePendingInquiriesCount()

  // Always show navigation immediately, but filter based on loading state and admin mode
  const filteredNavigation = navigationItems ? filterNavigationItems(
    navigationItems,
    canAccess,
    isAdmin,
    isLoading,
    adminMode
  ) : []

  const filteredSections = navigationSections ? filterNavigationSections(
    navigationSections,
    canAccess,
    isAdmin,
    isLoading,
    adminMode
  ) : []

  // Loading skeleton component for navigation items
  const LoadingSkeleton = () => (
    <div className="space-y-6">
      {/* Skeleton for multiple sections */}
      {[...Array(3)].map((_, sectionIndex) => (
        <div key={sectionIndex} className={sectionIndex > 0 ? "pt-2" : ""}>
          {/* Section header skeleton */}
          {!isCollapsed && (
            <div className="px-3 mb-2">
              <div className="h-3 bg-sidebar-foreground/20 rounded animate-pulse w-20" />
            </div>
          )}
          
          {/* Section items skeleton */}
          <div className="space-y-1">
            {[...Array(sectionIndex === 0 ? 1 : sectionIndex === 1 ? 4 : 3)].map((_, itemIndex) => (
              <div key={itemIndex} className="flex items-center px-3 h-10">
                <div className="h-5 w-5 bg-sidebar-foreground/20 rounded animate-pulse" />
                {!isCollapsed && (
                  <div className="ml-3 h-4 bg-sidebar-foreground/20 rounded animate-pulse flex-1" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <aside
      className={`${
        isMobileMode ? '' : 'fixed left-0 top-0 z-50'
      } ${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 border-r border-sidebar-border`}
      style={{
        height: '100svh', // Use small viewport height for mobile browsers (excludes address bar)
        minHeight: '100vh', // Fallback for browsers that don't support svh
      }}
    >
      {/* Logo Section */}
      <div className={cn(
        "h-16 flex items-center border-b border-sidebar-border shrink-0",
        isCollapsed ? "justify-center px-0" : "pl-[26px] pr-6"
      )}>
        <Microscope className="h-6 w-6 shrink-0" />
        {!isCollapsed && (
          <h1 className="font-bold text-lg ml-3 whitespace-nowrap">Pathology Bites</h1>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        <div className="p-3">
          {/* Show loading skeleton when no navigation items are provided or transitioning */}
          {(!navigationSections?.length && !navigationItems?.length) || isLoading || isTransitioning ? (
            <LoadingSkeleton />
          ) : (
            <>
              {/* Render sections if available */}
              {filteredSections.length > 0 ? (
            <div className="space-y-6">
              {filteredSections.map((section, sectionIndex) => (
                <div key={section.title} className={cn(
                  sectionIndex === 0 && !isCollapsed ? "mt-[4px]" : "" // Move Dashboard down 4px in expanded state
                )}>
                  {/* Section header - always takes space to keep alignment consistent */}
                  <h3 className={cn(
                    "px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider mb-2",
                    isCollapsed ? "invisible" : "" // Invisible but takes up exact same space when collapsed
                  )}>
                    {section.title}
                  </h3>

                  {/* Section items */}
                  <div className="space-y-1">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href
                      const IconComponent = iconMap[item.icon] || LayoutDashboard

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "flex items-center h-10 rounded-md text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 transition-colors",
                            isCollapsed ? "justify-center px-0 w-10" : "pl-[8px] pr-3",
                            isActive && "bg-sidebar-foreground/20 text-sidebar-foreground",
                            isLoading && "pointer-events-none opacity-60"
                          )}
                          title={isCollapsed ? item.name : undefined}
                        >
                          <IconComponent className="h-5 w-5 shrink-0" />
                          {!isCollapsed && (
                            <span className="truncate ml-3">{item.name}</span>
                          )}
                          {!isCollapsed && item.href === '/admin/inquiries' && pendingInquiriesCount > 0 && (
                            <span className="ml-auto text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold">
                              {pendingInquiriesCount}
                            </span>
                          )}
                          {!isCollapsed && item.comingSoon && (
                            <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Soon</span>
                          )}
                          {!isCollapsed && item.adminOnly && !isAdmin && !isLoading && (
                            <span className="ml-auto text-xs text-sidebar-foreground/50">Admin</span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Fallback to flat item list */
            <div className="space-y-1">
              {filteredNavigation.map((item) => {
                const isActive = pathname === item.href
                const IconComponent = iconMap[item.icon] || LayoutDashboard

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center h-10 rounded-md text-sidebar-foreground/90 hover:bg-sidebar-foreground/10 transition-colors",
                      isCollapsed ? "justify-center px-0 w-10" : "px-3",
                      isActive && "bg-sidebar-foreground/20 text-sidebar-foreground",
                      isLoading && "pointer-events-none opacity-60"
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <IconComponent className="h-5 w-5 shrink-0" />
                    {!isCollapsed && (
                      <span className="truncate ml-3">{item.name}</span>
                    )}
                    {!isCollapsed && item.href === '/admin/inquiries' && pendingInquiriesCount > 0 && (
                      <span className="ml-auto text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold">
                        {pendingInquiriesCount}
                      </span>
                    )}
                    {!isCollapsed && item.comingSoon && (
                      <span className="ml-auto text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Soon</span>
                    )}
                    {!isCollapsed && item.adminOnly && !isAdmin && !isLoading && (
                      <span className="ml-auto text-xs text-sidebar-foreground/50">Admin</span>
                    )}
                  </Link>
                )
              })}
            </div>
              )}
            </>
          )}
        </div>
      </nav>

      {/* Auth Status at Bottom */}
      <div className="mt-auto border-t border-sidebar-border">
        <SidebarAuthStatus isCollapsed={isCollapsed} />
      </div>
    </aside>
  )
}
