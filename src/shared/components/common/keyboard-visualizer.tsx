'use client'

import { useMemo } from 'react'
import { cn } from '@/shared/utils/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Keyboard } from 'lucide-react'

interface CellType {
  id: string
  name: string
  key: string
  count: number
  color: string
}

interface KeyboardVisualizerProps {
  cellTypes: CellType[]
  className?: string
}

interface KeyInfo {
  key: string
  label: string
  width?: 'sm' | 'md' | 'lg' | 'xl'
  isActive?: boolean
  cellType?: CellType
}

export function KeyboardVisualizer({ cellTypes, className }: KeyboardVisualizerProps) {
  // Create a map of used keys
  const usedKeysMap = useMemo(() => {
    const map = new Map<string, CellType>()
    cellTypes.forEach(cellType => {
      map.set(cellType.key.toLowerCase(), cellType)
    })
    return map
  }, [cellTypes])

  // Define keyboard layout
  const keyboardRows: KeyInfo[][] = [
    // Number row
    [
      { key: '`', label: '`' },
      { key: '1', label: '1' },
      { key: '2', label: '2' },
      { key: '3', label: '3' },
      { key: '4', label: '4' },
      { key: '5', label: '5' },
      { key: '6', label: '6' },
      { key: '7', label: '7' },
      { key: '8', label: '8' },
      { key: '9', label: '9' },
      { key: '0', label: '0' },
      { key: '-', label: '-' },
      { key: '=', label: '=' },
      { key: 'backspace', label: 'Backspace', width: 'lg' }
    ],
    // QWERTY row
    [
      { key: 'tab', label: 'Tab', width: 'md' },
      { key: 'q', label: 'Q' },
      { key: 'w', label: 'W' },
      { key: 'e', label: 'E' },
      { key: 'r', label: 'R' },
      { key: 't', label: 'T' },
      { key: 'y', label: 'Y' },
      { key: 'u', label: 'U' },
      { key: 'i', label: 'I' },
      { key: 'o', label: 'O' },
      { key: 'p', label: 'P' },
      { key: '[', label: '[' },
      { key: ']', label: ']' },
      { key: '\\', label: '\\', width: 'md' }
    ],
    // ASDF row
    [
      { key: 'caps', label: 'Caps', width: 'lg' },
      { key: 'a', label: 'A' },
      { key: 's', label: 'S' },
      { key: 'd', label: 'D' },
      { key: 'f', label: 'F' },
      { key: 'g', label: 'G' },
      { key: 'h', label: 'H' },
      { key: 'j', label: 'J' },
      { key: 'k', label: 'K' },
      { key: 'l', label: 'L' },
      { key: ';', label: ';' },
      { key: "'", label: "'" },
      { key: 'enter', label: 'Enter', width: 'lg' }
    ],
    // ZXCV row
    [
      { key: 'shift', label: 'Shift', width: 'xl' },
      { key: 'z', label: 'Z' },
      { key: 'x', label: 'X' },
      { key: 'c', label: 'C' },
      { key: 'v', label: 'V' },
      { key: 'b', label: 'B' },
      { key: 'n', label: 'N' },
      { key: 'm', label: 'M' },
      { key: ',', label: ',' },
      { key: '.', label: '.' },
      { key: '/', label: '/' },
      { key: 'rshift', label: 'Shift', width: 'xl' }
    ],
    // Space row
    [
      { key: 'ctrl', label: 'Ctrl', width: 'md' },
      { key: 'alt', label: 'Alt', width: 'md' },
      { key: 'space', label: 'Space', width: 'xl' },
      { key: 'ralt', label: 'Alt', width: 'md' },
      { key: 'rctrl', label: 'Ctrl', width: 'md' }
    ]
  ]

  // Add active state and cell type info to keys
  const enhancedRows = keyboardRows.map(row =>
    row.map(keyInfo => {
      const cellType = usedKeysMap.get(keyInfo.key.toLowerCase())
      return {
        ...keyInfo,
        isActive: !!cellType,
        cellType
      }
    })
  )

  const getKeyWidth = (width?: string) => {
    switch (width) {
      case 'sm': return 'w-6 md:w-8'
      case 'md': return 'w-8 md:w-12'
      case 'lg': return 'w-10 md:w-16'
      case 'xl': return 'w-12 md:w-20'
      default: return 'w-6 md:w-8'
    }
  }

  const getKeyColorClass = (cellType?: CellType) => {
    if (!cellType) return 'bg-muted hover:bg-muted/80'
    
    // Map the Tailwind color classes to actual background colors for active keys
    const colorMap: Record<string, string> = {
      'bg-primary': 'bg-primary/20 border-primary text-primary',
      'bg-blue-600': 'bg-blue-500/20 border-blue-500 text-blue-700',
      'bg-emerald-600': 'bg-emerald-500/20 border-emerald-500 text-emerald-700',
      'bg-violet-600': 'bg-violet-500/20 border-violet-500 text-violet-700',
      'bg-rose-600': 'bg-rose-500/20 border-rose-500 text-rose-700',
      'bg-amber-600': 'bg-amber-500/20 border-amber-500 text-amber-700',
      'bg-indigo-600': 'bg-indigo-500/20 border-indigo-500 text-indigo-700',
      'bg-pink-600': 'bg-pink-500/20 border-pink-500 text-pink-700',
      'bg-teal-600': 'bg-teal-500/20 border-teal-500 text-teal-700',
      'bg-orange-600': 'bg-orange-500/20 border-orange-500 text-orange-700',
      'bg-cyan-600': 'bg-cyan-500/20 border-cyan-500 text-cyan-700',
      'bg-lime-600': 'bg-lime-500/20 border-lime-500 text-lime-700',
      'bg-purple-600': 'bg-purple-500/20 border-purple-500 text-purple-700',
      'bg-slate-600': 'bg-slate-500/20 border-slate-500 text-slate-700'
    }
    
    return colorMap[cellType.color] || 'bg-primary/20 border-primary text-primary-foreground'
  }

  return (
    <Card className={cn('hidden md:block', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Keyboard className="h-5 w-5" />
          Keyboard Layout
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
        {enhancedRows.map((row, rowIndex) => (
          <div key={rowIndex} className="flex justify-center gap-1">
            {row.map((keyInfo, keyIndex) => (
              <div
                key={`${rowIndex}-${keyIndex}`}
                className={cn(
                  'relative flex items-center justify-center h-6 md:h-8 rounded border text-xs font-medium transition-all duration-200',
                  getKeyWidth(keyInfo.width),
                  getKeyColorClass(keyInfo.cellType),
                  keyInfo.isActive && 'border-2 shadow-sm'
                )}
                title={keyInfo.cellType ? `${keyInfo.cellType.name} (${keyInfo.cellType.count} counted)` : keyInfo.label}
              >
                <span className="text-center leading-none text-xs md:text-xs">
                  {keyInfo.label.length > 4 ? keyInfo.label.slice(0, 2) : keyInfo.label}
                </span>
                {keyInfo.cellType && keyInfo.cellType.count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 md:-top-1 md:-right-1 bg-accent text-accent-foreground text-xs rounded-full w-3 h-3 md:w-4 md:h-4 flex items-center justify-center font-bold">
                    {keyInfo.cellType.count > 99 ? '99+' : keyInfo.cellType.count}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
        
        {/* Legend - Show ALL cell types */}
        {cellTypes.length > 0 && (
          <div className="mt-4 pt-3 border-t">
            <div className="text-xs text-muted-foreground mb-2">Active Keys:</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1 text-xs">
              {cellTypes.map(cellType => (
                <div key={cellType.id} className="flex items-center gap-1">
                  <div className={cn('w-3 h-3 rounded border', getKeyColorClass(cellType))} />
                  <span className="truncate">{cellType.name}</span>
                  <span className="text-muted-foreground">({cellType.key})</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </div>
      </CardContent>
    </Card>
  )
}