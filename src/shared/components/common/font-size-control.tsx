// src/shared/components/common/font-size-control.tsx
'use client'

import { Minus, Plus, Type } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { useFontSize } from '@/shared/contexts/font-size-context'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { useState } from 'react'

export function FontSizeControl() {
  const { fontSize, increaseFontSize, decreaseFontSize, resetFontSize, canIncrease, canDecrease } = useFontSize()
  const [isOpen, setIsOpen] = useState(false)

  const fontSizePercentage = Math.round(fontSize * 100)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hover:bg-primary/10"
          title="Adjust text size"
        >
          <Type size={20} className="icon-fixed-size" data-icon-fixed />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-3" align="end">
        <div className="space-y-3">
          <div className="text-sm font-medium text-center">
            Text Size
          </div>
          
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon"
              onClick={decreaseFontSize}
              disabled={!canDecrease}
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
              onClick={increaseFontSize}
              disabled={!canIncrease}
              className="h-8 w-8"
              title="Increase text size"
            >
              <Plus size={14} className="icon-fixed-size" data-icon-fixed />
            </Button>
          </div>

          {fontSize !== 1.0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFontSize}
              className="w-full h-8 text-xs"
            >
              Reset to Default
            </Button>
          )}
          
          <div className="text-xs text-muted-foreground text-center">
            Range: 75% - 100%
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
