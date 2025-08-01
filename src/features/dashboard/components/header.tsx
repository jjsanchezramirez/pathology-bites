// src/components/dashboard/header.tsx
"use client"

import { Button } from "@/shared/components/ui/button"
import { Menu, Sun, Moon, Monitor } from "lucide-react"
import { cn } from "@/shared/utils"
import { ProfileDropdown } from "@/features/dashboard/components/profile-dropdown"
import { useTheme } from "next-themes"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu"
import { useState, useEffect } from "react"

interface HeaderProps {
  isOpen: boolean
  onMenuClick: () => void
}

export function Header({ isOpen, onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const getThemeIcon = () => {
    if (!mounted) return <Sun size={20} />

    switch (theme) {
      case 'dark':
        return <Moon size={20} />
      case 'light':
        return <Sun size={20} />
      case 'system':
      default:
        return <Monitor size={20} />
    }
  }

  return (
    <header className={cn(
      "fixed top-0 right-0 h-16 bg-background z-10 border-b",
      "transition-all duration-300 ease-in-out",
      isOpen ? "left-64" : "left-20"
    )}>
      <div className="flex items-center justify-between h-full px-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="hover:bg-primary/10"
          >
            <Menu size={20} />
          </Button>
          <h1 className="text-xl font-semibold">Overview</h1>
        </div>

        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-primary/10"
                disabled={!mounted}
              >
                {getThemeIcon()}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" />
                Light
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" />
                Dark
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Monitor className="mr-2 h-4 w-4" />
                System
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}