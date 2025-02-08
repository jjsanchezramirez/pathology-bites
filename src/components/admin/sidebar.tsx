// src/components/admin/sidebar.tsx
'use client'

import { 
  LayoutDashboard, 
  Users, 
  FileQuestion,
  BarChart,
  Image,
  Settings,
  Microscope
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

const navigation = [
  {
    name: "Overview",
    href: "/admin",
    icon: LayoutDashboard
  },
  {
    name: "Questions",
    href: "/admin/questions",
    icon: FileQuestion
  },
  {
    name: "Users",
    href: "/admin/users",
    icon: Users
  },
  {
    name: "Images",
    href: "/admin/images",
    icon: Image
  },
  {
    name: "Analytics",
    href: "/admin/analytics",
    icon: BarChart
  },
  {
    name: "Settings",
    href: "/admin/settings",
    icon: Settings
  }
]

interface SidebarProps {
  isCollapsed: boolean;
}

export function AdminSidebar({ isCollapsed }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside 
      className={`${
        isCollapsed ? 'w-16' : 'w-64'
      } bg-slate-900 text-slate-100 dark:bg-slate-800/95 flex flex-col flex-shrink-0 transition-all duration-300`}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center px-6 border-b border-slate-700/50 dark:border-slate-600/50">
        <Microscope className="h-6 w-6 flex-shrink-0" />
        {!isCollapsed && (
          <h1 className="font-bold text-lg ml-3 whitespace-nowrap">Pathology Bites</h1>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4">
        <div className="space-y-1 px-3">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex h-10 rounded-lg text-sm font-medium 
                  transition-colors duration-200 relative
                  ${isActive 
                    ? 'bg-slate-800 text-slate-100 dark:bg-slate-700 dark:text-white' 
                    : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/50 dark:hover:text-white'
                  }`}
                title={isCollapsed ? item.name : undefined}
              >
                <div className={`
                  absolute left-3 top-1/2 -translate-y-1/2
                  flex items-center
                  ${isCollapsed ? 'w-5 justify-center' : ''}
                `}>
                  <item.icon className="h-5 w-5" />
                </div>
                {!isCollapsed && (
                  <span className="truncate pl-10 py-2.5">{item.name}</span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}