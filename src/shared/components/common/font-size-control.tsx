// src/shared/components/common/font-size-control.tsx
'use client'

import { Minus, Plus, Type, Check, Palette } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { Separator } from '@/shared/components/ui/separator'
import { useState } from 'react'
import { useTextZoom } from '@/shared/contexts/font-size-context'
import { getTextZoomConfig } from '@/shared/utils/text-zoom'
import { useDashboardTheme } from '@/shared/contexts/dashboard-theme-context'
import { cn } from '@/shared/utils'

export function FontSizeControl() {
  const [isOpen, setIsOpen] = useState(false)
  const {
    textZoom,
    increaseTextZoom,
    decreaseTextZoom,
    resetTextZoom,
    canIncrease,
    canDecrease,
    isLoading: textZoomLoading
  } = useTextZoom()
  const config = getTextZoomConfig()

  // Theme selection functionality
  const { currentTheme, setTheme, availableThemes, isLoading: themeLoading } = useDashboardTheme()

  const fontSizePercentage = Math.round(textZoom * 100)
  const minPercentage = Math.round(config.min * 100)
  const maxPercentage = Math.round(config.max * 100)
  const isLoading = textZoomLoading || themeLoading

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10"
          title="Text size & theme settings"
          disabled={isLoading}
        >
          <Type size={20} className="icon-fixed-size" data-icon-fixed />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-4">
          {/* Text Size Section */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-center">
              Text Size
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="icon"
                onClick={decreaseTextZoom}
                disabled={!canDecrease || isLoading}
                className="h-8 w-8"
                title="Decrease text size"
              >
                <Minus size={14} className="icon-fixed-size" data-icon-fixed />
              </Button>

              <div className="text-sm text-muted-foreground min-w-[3rem] text-center">
                {fontSizePercentage}%
              </div>

              <Button
                variant="outline"
                size="icon"
                onClick={increaseTextZoom}
                disabled={!canIncrease || isLoading}
                className="h-8 w-8"
                title="Increase text size"
              >
                <Plus size={14} className="icon-fixed-size" data-icon-fixed />
              </Button>
            </div>

            {textZoom !== config.default && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetTextZoom}
                disabled={isLoading}
                className="w-full h-8 text-xs"
              >
                Reset to Default
              </Button>
            )}

            <div className="text-xs text-muted-foreground text-center">
              Range: {minPercentage}% - {maxPercentage}%
            </div>
          </div>

          {/* Separator */}
          <Separator />

          {/* Theme Selection Section */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-center">
              Dashboard Theme
            </div>

            <div className="grid gap-1">
              {availableThemes.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setTheme(theme.id)}
                  disabled={isLoading}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-md text-left transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    currentTheme.id === theme.id && "bg-accent text-accent-foreground"
                  )}
                >
                  {/* Theme Preview */}
                  <div
                    className="w-4 h-4 rounded-full border border-border flex-shrink-0"
                    style={{ background: theme.preview }}
                  />

                  {/* Theme Name */}
                  <span className="text-sm flex-1">{theme.name}</span>

                  {/* Check Mark */}
                  {currentTheme.id === theme.id && (
                    <Check className="h-3 w-3 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
