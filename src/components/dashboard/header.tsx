// src/components/dashboard/header.tsx
"use client"

import { Button } from "@/components/ui/button"
import { Menu, Sun, Moon } from "lucide-react"
import { cn } from "@/lib/utils"
import { ProfileDropdown } from "@/components/dashboard/profile-dropdown"
import { useTheme } from "next-themes"

interface HeaderProps {
  isOpen: boolean
  onMenuClick: () => void
}

export function Header({ isOpen, onMenuClick }: HeaderProps) {
  const { theme, setTheme } = useTheme()

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
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hover:bg-primary/10"
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </Button>
          <ProfileDropdown />
        </div>
      </div>
    </header>
  )
}