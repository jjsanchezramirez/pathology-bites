// src/features/dashboard/components/theme-selector.tsx
'use client'

import { useState } from 'react'
import { Check, Palette } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { useDashboardTheme } from '@/shared/contexts/dashboard-theme-context'
import { cn } from '@/shared/utils'

export function ThemeSelector() {
  const { currentTheme, setTheme, availableThemes, isLoading } = useDashboardTheme()
  const [isOpen, setIsOpen] = useState(false)

  if (isLoading) {
    return (
      <Button variant="ghost" size="icon" disabled>
        <Palette className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon"
          className="hover:bg-primary/10"
          title="Change dashboard theme"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <DropdownMenuLabel>Dashboard Themes</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="grid gap-1 p-1">
          {availableThemes.map((theme) => (
            <DropdownMenuItem
              key={theme.id}
              onClick={() => {
                setTheme(theme.id)
                setIsOpen(false)
              }}
              className={cn(
                "flex items-center gap-3 p-3 cursor-pointer rounded-md",
                "hover:bg-accent hover:text-accent-foreground",
                currentTheme.id === theme.id && "bg-accent text-accent-foreground"
              )}
            >
              {/* Theme Preview */}
              <div 
                className="w-6 h-6 rounded-full border-2 border-border flex-shrink-0"
                style={{ background: theme.preview }}
              />
              
              {/* Theme Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{theme.name}</span>
                  {currentTheme.id === theme.id && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {theme.description}
                </p>
              </div>
            </DropdownMenuItem>
          ))}
        </div>
        
        <DropdownMenuSeparator />
        <div className="p-2">
          <p className="text-xs text-muted-foreground text-center">
            Themes apply only to dashboard pages
          </p>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Alternative compact theme selector for smaller spaces
export function CompactThemeSelector() {
  const { currentTheme, setTheme, availableThemes, isLoading } = useDashboardTheme()

  if (isLoading) {
    return (
      <div className="w-6 h-6 rounded-full bg-muted animate-pulse" />
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button 
          className="w-6 h-6 rounded-full border-2 border-border hover:border-primary transition-colors"
          style={{ background: currentTheme.preview }}
          title={`Current theme: ${currentTheme.name}`}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Themes</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {availableThemes.map((theme) => (
          <DropdownMenuItem
            key={theme.id}
            onClick={() => setTheme(theme.id)}
            className="flex items-center gap-2"
          >
            <div 
              className="w-4 h-4 rounded-full border border-border"
              style={{ background: theme.preview }}
            />
            <span className="text-sm">{theme.name}</span>
            {currentTheme.id === theme.id && (
              <Check className="h-3 w-3 ml-auto text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
