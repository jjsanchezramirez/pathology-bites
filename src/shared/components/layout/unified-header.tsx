// src/shared/components/layout/unified-header.tsx
'use client'

import { Button } from "@/shared/components/ui/button"
import { Menu } from "lucide-react"
import { FontSizeControl } from "@/shared/components/common/font-size-control"
import { ThemeModeToggle } from "@/shared/components/common/theme-mode-toggle"
import { AdminModeToggle } from "@/shared/components/common/admin-mode-toggle"
import { NotificationsHandler } from "@/shared/components/layout/notifications-handler"
import { ProfileDropdown } from "@/features/dashboard/components/profile-dropdown"

export interface HeaderConfig {
  showNotifications?: boolean
  showFontSize?: boolean
}

interface UnifiedHeaderProps {
  onToggleSidebar: () => void
  config?: HeaderConfig
}

const defaultConfig: HeaderConfig = {
  showNotifications: false,
  showFontSize: false,
}

export function UnifiedHeader({ onToggleSidebar, config = defaultConfig }: UnifiedHeaderProps) {
  const finalConfig = { ...defaultConfig, ...config }

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

      {/* Admin Mode Toggle - Only show for admin users */}
      <AdminModeToggle />
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Font Size Control - Only show if enabled */}
        {finalConfig.showFontSize && <FontSizeControl />}
        
        {/* Theme Toggle - Always show */}
        <ThemeModeToggle />
        
        {/* Notifications - Only show if enabled */}
        {finalConfig.showNotifications && <NotificationsHandler />}
        
        {/* Profile Dropdown - Always show */}
        <ProfileDropdown />
      </div>
    </header>
  )
}
