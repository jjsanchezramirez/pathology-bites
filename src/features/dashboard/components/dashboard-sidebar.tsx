// src/features/dashboard/components/dashboard-sidebar.tsx
'use client'

import {
  LayoutDashboard,
  Plus,
  ClipboardList,
  BarChart3,
  Brain,
  Target,
  BookOpen,
  TrendingUp,
  Microscope,
  FileText
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { SidebarAuthStatus } from "@/shared/components/layout/sidebar-auth-status"
import { SidebarConnectionStatus } from "./sidebar-connection-status"

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard
  },
  {
    name: "New Quiz",
    href: "/dashboard/quiz/new",
    icon: Plus
  },
  {
    name: "Tutor Mode",
    href: "/dashboard/quiz/tutor",
    icon: Brain
  },
  {
    name: "My Quizzes",
    href: "/dashboard/quizzes",
    icon: ClipboardList
  },
  {
    name: "Performance",
    href: "/dashboard/performance",
    icon: BarChart3
  },
  {
    name: "Study Goals",
    href: "/dashboard/goals",
    icon: Target
  },
  {
    name: "Learning Path",
    href: "/dashboard/learning-path",
    icon: BookOpen
  },
  {
    name: "Progress",
    href: "/dashboard/progress",
    icon: TrendingUp
  },
  {
    name: "Pathology Outlines",
    href: "/dashboard/pathology-outlines",
    icon: FileText
  }
]

interface SidebarProps {
  isCollapsed: boolean;
}

export function DashboardSidebar({ isCollapsed }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-50 ${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-slate-900 text-slate-100 dark:bg-slate-800/95 flex flex-col transition-all duration-300 border-r border-slate-700/50`}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center px-6 border-b border-slate-700/50 dark:border-slate-600/50 shrink-0">
        <Microscope className="h-6 w-6 shrink-0" />
        {!isCollapsed && (
          <h1 className="font-bold text-lg ml-3 whitespace-nowrap">Pathology Bites</h1>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        <div className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex h-10 rounded-lg text-sm font-medium
                  transition-colors duration-200 relative items-center
                  ${isActive
                    ? 'bg-slate-800 text-slate-100 dark:bg-slate-700 dark:text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white'
                  }`}
                title={isCollapsed ? item.name : undefined}
              >
                <div className="flex items-center justify-center w-10 shrink-0">
                  <item.icon className="h-5 w-5" />
                </div>
                {!isCollapsed && (
                  <span className="truncate">{item.name}</span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Network Status at Bottom */}
      <div className="shrink-0">
        <SidebarConnectionStatus isCollapsed={isCollapsed} />
      </div>

      {/* Auth Status at Bottom */}
      <div className="shrink-0">
        <SidebarAuthStatus isCollapsed={isCollapsed} />
      </div>
    </aside>
  )
}
