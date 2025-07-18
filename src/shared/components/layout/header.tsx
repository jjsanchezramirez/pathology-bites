// src/components/admin/header.tsx
'use client'

import { Search, Menu } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { ProfileDropdown } from "@/features/dashboard/components/profile-dropdown"
import { ThemeToggle } from "@/shared/components/common/theme-toggle"
import { FontSizeControl } from "@/shared/components/common/font-size-control"
import { NotificationsHandler } from "@/shared/components/layout/notifications-handler"

interface HeaderProps {
  onToggleSidebar: () => void;
}

export function AdminHeader({ onToggleSidebar }: HeaderProps) {
  return (
    <header className="h-16 border-b bg-background/95 backdrop-blur-sm flex items-center px-4 gap-4 shrink-0 z-40">
      {/* Sidebar Toggle */}
      <Button 
        variant="ghost" 
        size="icon"
        onClick={onToggleSidebar}
        className="text-muted-foreground hover:text-foreground"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <div className="w-64">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search..."
            className="pl-8 h-9"
          />
        </div>
      </div>
      
      <div className="ml-auto flex items-center gap-2">
        <FontSizeControl />
        <ThemeToggle />
        <NotificationsHandler />
        <ProfileDropdown />
      </div>
    </header>
  )
}