'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

import {
  Plus,
  RotateCcw,
  Copy,
  Settings,
  Keyboard,
  Target,
  CheckCircle,
  Trash2,
  Download,
  Hash
} from 'lucide-react'
import { PublicHero } from '@/shared/components/common/public-hero'
import { JoinCommunitySection } from '@/shared/components/common/join-community-section'
import { KeyboardVisualizer } from '@/shared/components/common/keyboard-visualizer'
import { toast } from 'sonner'

interface CellType {
  id: string
  name: string
  key: string
  count: number
  color: string
}

interface CounterSettings {
  countLimit: number
  enableLimit: boolean
  enableUndo: boolean
  maxUndoHistory: number
}

interface CounterState {
  cellTypes: CellType[]
  settings: CounterSettings
  undoHistory: CellType[][]
  isComplete: boolean
  totalCount: number
}

const DEFAULT_CELL_TYPES: CellType[] = [
  { id: '1', name: 'Blast', key: 't', count: 0, color: 'bg-primary' },
  { id: '2', name: 'Promyelocyte', key: 'y', count: 0, color: 'bg-blue-600' },
  { id: '3', name: 'Myelocyte', key: 'u', count: 0, color: 'bg-emerald-600' },
  { id: '4', name: 'Metamyelocyte', key: 'h', count: 0, color: 'bg-violet-600' },
  { id: '5', name: 'Band neutrophil', key: 'j', count: 0, color: 'bg-rose-600' },
  { id: '6', name: 'Segmented neutrophil', key: 'k', count: 0, color: 'bg-amber-600' },
  { id: '7', name: 'Monocyte', key: 'l', count: 0, color: 'bg-indigo-600' },
  { id: '8', name: 'Lymphocyte', key: ';', count: 0, color: 'bg-pink-600' },
  { id: '9', name: 'Plasma cell', key: "'", count: 0, color: 'bg-teal-600' },
  { id: '10', name: 'Macrophage', key: 'o', count: 0, color: 'bg-orange-600' },
  { id: '11', name: 'Nucleated erythroid', key: 'p', count: 0, color: 'bg-cyan-600' },
  { id: '12', name: 'Eosinophil', key: 'n', count: 0, color: 'bg-lime-600' },
  { id: '13', name: 'Basophil', key: 'b', count: 0, color: 'bg-purple-600' },
  { id: '14', name: 'Mast cell', key: 'm', count: 0, color: 'bg-slate-600' }
]

const DEFAULT_SETTINGS: CounterSettings = {
  countLimit: 100,
  enableLimit: true,
  enableUndo: true,
  maxUndoHistory: 50
}

const STORAGE_KEY = 'pathology-bites-cell-counter'

export default function CellCounterPage() {
  const [state, setState] = useState<CounterState>({
    cellTypes: DEFAULT_CELL_TYPES,
    settings: DEFAULT_SETTINGS,
    undoHistory: [],
    isComplete: false,
    totalCount: 0
  })
  

  const [newCellName, setNewCellName] = useState('')
  const [newCellKey, setNewCellKey] = useState('')
  const [isCountingActive, setIsCountingActive] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate total count
  const totalCount = state.cellTypes.reduce((sum, cell) => sum + cell.count, 0)

  // Check if counting is complete
  const isComplete = state.settings.enableLimit && totalCount >= state.settings.countLimit

  // Check if current setup is PB/BM preset (based on cell names)
  const isPBBMPreset = state.cellTypes.some(cell => cell.name === 'Blast') && 
                       state.cellTypes.some(cell => cell.name === 'Nucleated erythroid') &&
                       state.cellTypes.length >= 13

  // Calculate M:E ratio for PB/BM preset
  const calculateMEratio = () => {
    if (!isPBBMPreset) return null

    const myeloidCells = [
      'Blast', 'Promyelocyte', 'Myelocyte', 'Metamyelocyte', 
      'Band neutrophil', 'Segmented neutrophil', 'Eosinophil', 
      'Basophil', 'Mast cell'
    ]
    
    const erythroidCells = ['Nucleated erythroid']
    
    const myeloidCount = state.cellTypes
      .filter(cell => myeloidCells.includes(cell.name))
      .reduce((sum, cell) => sum + cell.count, 0)
    
    const erythroidCount = state.cellTypes
      .filter(cell => erythroidCells.includes(cell.name))
      .reduce((sum, cell) => sum + cell.count, 0)
    
    if (erythroidCount === 0) return null
    
    return {
      myeloidCount,
      erythroidCount,
      ratio: (myeloidCount / erythroidCount).toFixed(2)
    }
  }

  const meRatio = calculateMEratio()

  // Load saved state from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsedState = JSON.parse(saved)
        setState(prevState => ({
          ...prevState,
          ...parsedState,
          undoHistory: [], // Don't restore undo history
          isComplete: false
        }))
      }
    } catch (error) {
      // Failed to load saved state - will use defaults
    }
  }, [])

  // Save state to localStorage
  const saveState = useCallback((newState: CounterState) => {
    try {
      const stateToSave = {
        cellTypes: newState.cellTypes,
        settings: newState.settings
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave))
    } catch (error) {
      // Failed to save state - operation will continue
    }
  }, [])

  // Update state and save
  const updateState = useCallback((updater: (prev: CounterState) => CounterState) => {
    setState(prev => {
      const newState = updater(prev)
      saveState(newState)
      return newState
    })
  }, [saveState])

  // Add cell type
  const addCellType = useCallback(() => {
    if (!newCellName.trim()) {
      toast.error('Please enter cell name')
      return
    }

    if (state.cellTypes.length >= 20) {
      toast.error('Maximum 20 cell types allowed')
      return
    }

    // Auto-assign key if not provided (mobile case)
    let assignedKey = newCellKey.trim().toLowerCase()
    if (!assignedKey) {
      // Try first letter of cell name, then available letters
      const availableKeys = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('')
      const usedKeys = state.cellTypes.map(cell => cell.key.toLowerCase())
      
      // Try first letter of name first
      const firstLetter = newCellName.trim()[0].toLowerCase()
      if (!usedKeys.includes(firstLetter)) {
        assignedKey = firstLetter
      } else {
        // Find first available key
        assignedKey = availableKeys.find(key => !usedKeys.includes(key)) || '0'
      }
    }

    const keyExists = state.cellTypes.some(cell => cell.key.toLowerCase() === assignedKey)
    if (keyExists) {
      toast.error('Key already in use')
      return
    }

    const colors = [
      'bg-primary', 'bg-blue-600', 'bg-emerald-600', 'bg-violet-600', 'bg-rose-600',
      'bg-amber-600', 'bg-indigo-600', 'bg-pink-600', 'bg-teal-600', 'bg-orange-600'
    ]
    
    const newCell: CellType = {
      id: Date.now().toString(),
      name: newCellName.trim(),
      key: assignedKey,
      count: 0,
      color: colors[state.cellTypes.length % colors.length]
    }

    updateState(prev => ({
      ...prev,
      cellTypes: [...prev.cellTypes, newCell]
    }))

    setNewCellName('')
    setNewCellKey('')
    // toast.success(`Added ${newCell.name} (${newCell.key})`)
  }, [newCellName, newCellKey, state.cellTypes, updateState])

  // Remove cell type
  const removeCellType = useCallback((id: string) => {
    updateState(prev => ({
      ...prev,
      cellTypes: prev.cellTypes.filter(cell => cell.id !== id)
    }))
    // toast.success('Cell type removed')
  }, [updateState])

  // Increment cell count
  const incrementCell = useCallback((key: string) => {
    if (isComplete) {
      return // Don't show toast for key presses when limit reached
    }

    const cellIndex = state.cellTypes.findIndex(cell => cell.key === key)
    if (cellIndex === -1) return

    // Save current state to undo history
    if (state.settings.enableUndo) {
      updateState(prev => {
        const newUndoHistory = [...prev.undoHistory, prev.cellTypes]
        if (newUndoHistory.length > prev.settings.maxUndoHistory) {
          newUndoHistory.shift()
        }

        const newCellTypes = [...prev.cellTypes]
        newCellTypes[cellIndex] = {
          ...newCellTypes[cellIndex],
          count: newCellTypes[cellIndex].count + 1
        }

        return {
          ...prev,
          cellTypes: newCellTypes,
          undoHistory: newUndoHistory
        }
      })
    } else {
      updateState(prev => {
        const newCellTypes = [...prev.cellTypes]
        newCellTypes[cellIndex] = {
          ...newCellTypes[cellIndex],
          count: newCellTypes[cellIndex].count + 1
        }
        return {
          ...prev,
          cellTypes: newCellTypes
        }
      })
    }

    // No toast for individual key presses - removed for better UX
  }, [state.cellTypes, state.settings, isComplete, updateState])

  // Decrement specific cell count
  const decrementCell = useCallback((key: string) => {
    const cellIndex = state.cellTypes.findIndex(cell => cell.key === key)
    if (cellIndex === -1) return
    
    const cell = state.cellTypes[cellIndex]
    if (cell.count === 0) return

    // Save current state to undo history
    if (state.settings.enableUndo) {
      updateState(prev => {
        const newUndoHistory = [...prev.undoHistory, prev.cellTypes]
        if (newUndoHistory.length > prev.settings.maxUndoHistory) {
          newUndoHistory.shift()
        }

        const newCellTypes = [...prev.cellTypes]
        newCellTypes[cellIndex] = {
          ...newCellTypes[cellIndex],
          count: Math.max(0, newCellTypes[cellIndex].count - 1)
        }

        return {
          ...prev,
          cellTypes: newCellTypes,
          undoHistory: newUndoHistory
        }
      })
    } else {
      updateState(prev => {
        const newCellTypes = [...prev.cellTypes]
        newCellTypes[cellIndex] = {
          ...newCellTypes[cellIndex],
          count: Math.max(0, newCellTypes[cellIndex].count - 1)
        }
        return {
          ...prev,
          cellTypes: newCellTypes
        }
      })
    }
  }, [state.cellTypes, state.settings, updateState])

  // Undo last action
  const undoLastAction = useCallback(() => {
    if (state.undoHistory.length === 0) {
      toast.error('Nothing to undo')
      return
    }

    updateState(prev => ({
      ...prev,
      cellTypes: prev.undoHistory[prev.undoHistory.length - 1],
      undoHistory: prev.undoHistory.slice(0, -1)
    }))

    // toast.success('Undone last action')
  }, [state.undoHistory, updateState])

  // Reset all counts
  const resetCounts = useCallback(() => {
    updateState(prev => ({
      ...prev,
      cellTypes: prev.cellTypes.map(cell => ({ ...cell, count: 0 })),
      undoHistory: []
    }))
    // toast.success('All counts reset')
  }, [updateState])

  // Export results with RTF table format
  const exportResults = useCallback((format: 'text' | 'rtf' = 'text') => {
    if (totalCount === 0) {
      toast.error('No data to export')
      return
    }

    const timestamp = new Date().toLocaleString()
    const filteredCells = state.cellTypes.filter(cell => cell.count > 0)

    if (format === 'rtf') {
      // RTF Table Format - Compatible with Word processors
      const rtfHeader = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}
\\f0\\fs24 Cell Counter Results - ${timestamp}\\par
\\par
{\\colortbl;\\red0\\green0\\blue0;\\red255\\green255\\blue255;}
\\trowd\\trgaph108\\trleft-108
\\cellx2000\\cellx4000\\cellx6000
\\intbl \\b Cell Type \\cell \\b Count \\cell \\b Percentage \\cell \\row
`

      const rtfRows = filteredCells
        .map(cell => {
          const percentage = ((cell.count / totalCount) * 100).toFixed(1)
          return `\\intbl ${cell.name} \\cell ${cell.count} \\cell ${percentage}% \\cell \\row`
        })
        .join('\n')

      const rtfFooter = `\\trowd\\trgaph108\\trleft-108
\\cellx6000
\\intbl \\b Total Count: ${totalCount} \\cell \\row
}`

      const exportText = rtfHeader + rtfRows + '\n' + rtfFooter

      navigator.clipboard.writeText(exportText).then(() => {
        toast.success('RTF table copied! Paste into Word/RTF editor.')
      }).catch(() => {
        toast.error('Failed to copy to clipboard')
      })
    } else {
      // Plain text format (improved)
      const header = `Cell Counter Results - ${timestamp}\n${'='.repeat(50)}\n\n`
      
      // Tab-delimited format for better table compatibility
      const tableHeader = 'Cell Type\tCount\tPercentage\n' + '-'.repeat(40) + '\n'

      const rows = filteredCells
        .map(cell => {
          const percentage = ((cell.count / totalCount) * 100).toFixed(1)
          return `${cell.name}\t${cell.count}\t${percentage}%`
        })
        .join('\n')

      const footer = `\n${'-'.repeat(40)}\nTotal Count:\t${totalCount}\n`

      const exportText = header + tableHeader + rows + footer

      navigator.clipboard.writeText(exportText).then(() => {
        toast.success('Table copied! Paste into Excel or text editor.')
      }).catch(() => {
        toast.error('Failed to copy to clipboard')
      })
    }
  }, [state.cellTypes, totalCount])

  // Keyboard event handler
  useEffect(() => {
    if (!isCountingActive) return

    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent default for our handled keys
      const key = event.key.toLowerCase()

      // Handle Shift + cell key for decrementing first
      if (event.shiftKey) {
        const cellExists = state.cellTypes.some(cell => cell.key === key)
        if (cellExists) {
          event.preventDefault()
          decrementCell(key)
          return
        }
      }

      // Check if it's a cell type key (without shift)
      const cellExists = state.cellTypes.some(cell => cell.key === key)
      if (cellExists && !event.shiftKey) {
        event.preventDefault()
        incrementCell(key)
        return
      }

      // Handle special keys
      switch (key) {
        case 'escape':
          event.preventDefault()
          setIsCountingActive(false)
          // toast.info('Counting stopped')
          break
        case 'z':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            undoLastAction()
          }
          break
        case 'backspace':
          event.preventDefault()
          undoLastAction()
          break
        case 'r':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            resetCounts()
          }
          break
        case 'c':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            exportResults('text')
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isCountingActive, state.cellTypes, incrementCell, decrementCell, undoLastAction, resetCounts, exportResults])

  // Check for completion
  useEffect(() => {
    if (isComplete && !state.isComplete) {
      updateState(prev => ({ ...prev, isComplete: true }))
      toast.success('Count limit reached! Counting complete.', {
        duration: 5000
      })
    }
  }, [isComplete, state.isComplete, updateState])

  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <PublicHero
        title="Cell Counter Tool"
        description="Efficient cell counting with customizable keyboard shortcuts. Perfect for differential counts, cell morphology studies, and laboratory work."
        actions={
          <div className="flex gap-4 pt-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Keyboard className="h-4 w-4" />
              <span>Keyboard Shortcuts</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="h-4 w-4" />
              <span>Configurable Limits</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Download className="h-4 w-4" />
              <span>Export Results</span>
            </div>
          </div>
        }
      />

      {/* Main Content */}
      <section className="relative py-4 md:py-8">
        <div className="container mx-auto px-4 max-w-6xl" ref={containerRef}>
          <div className="grid gap-4 md:gap-6 lg:grid-cols-5">
            
            {/* Simplified Setup Panel */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Quick Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  {/* Quick Presets */}
                  <div className="space-y-2">
                    <Label>Common Presets</Label>
                    <div className="grid gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateState(prev => ({
                            ...prev,
                            cellTypes: DEFAULT_CELL_TYPES,
                            settings: { ...DEFAULT_SETTINGS, countLimit: 100, enableLimit: true }
                          }))
                          // toast.success('Peripheral Blood / Bone Marrow preset loaded')
                        }}
                        disabled={isCountingActive}
                        className="justify-start"
                      >
                        🩸 PB/BM Differential (100 cells)
                      </Button>
                    </div>
                  </div>

                  {/* Add Cell Type - Simplified */}
                  <div className="space-y-3">
                    <Label>Add Cell Type</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Cell name"
                        value={newCellName}
                        onChange={(e) => setNewCellName(e.target.value)}
                        maxLength={20}
                        className="flex-1"
                      />
                      <Input
                        placeholder="Key"
                        value={newCellKey}
                        onChange={(e) => setNewCellKey(e.target.value.toLowerCase())}
                        maxLength={1}
                        className="w-16 hidden md:block"
                      />
                      <Button 
                        onClick={addCellType}
                        disabled={state.cellTypes.length >= 20}
                        size="icon"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Current Cell Types - Compact */}
                  {state.cellTypes.length > 0 && (
                    <div className="space-y-2">
                      <Label>Active Types ({state.cellTypes.length}/20)</Label>
                      <div className="grid gap-1">
                        {state.cellTypes.map((cell) => (
                          <div key={cell.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{cell.name}</span>
                              <kbd className="px-1.5 py-0.5 bg-background border border-gray-300 rounded text-xs font-medium shadow-sm hidden md:inline-flex">
                                {cell.key}
                              </kbd>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeCellType(cell.id)}
                              disabled={isCountingActive}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Simple Settings */}
                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex items-center justify-between">
                      <Label>Count Limit:</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="10"
                          max="10000"
                          value={state.settings.countLimit}
                          onChange={(e) => updateState(prev => ({
                            ...prev,
                            settings: { ...prev.settings, countLimit: parseInt(e.target.value) || 100 }
                          }))}
                          disabled={isCountingActive || !state.settings.enableLimit}
                          className="w-20 text-sm"
                        />
                        <input
                          type="checkbox"
                          checked={state.settings.enableLimit}
                          onChange={(e) => updateState(prev => ({
                            ...prev,
                            settings: { ...prev.settings, enableLimit: e.target.checked }
                          }))}
                          disabled={isCountingActive}
                          className="rounded"
                        />
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      onClick={() => {
                        updateState(prev => ({
                          ...prev,
                          cellTypes: [],
                          undoHistory: []
                        }))
                        // toast.success('Cleared all cell types')
                      }}
                      disabled={isCountingActive}
                      className="w-full"
                      size="sm"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Clear All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Counting Interface */}
            <div className="lg:col-span-3 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Cell Counter
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      Total: {totalCount}
                      {state.settings.enableLimit && (
                        <span>/ {state.settings.countLimit}</span>
                      )}
                      {isComplete && (
                        <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!isCountingActive ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        Click "Start Counting" to begin. Use keyboard shortcuts to count cells efficiently.
                      </p>
                      <Button
                        size="lg"
                        onClick={() => setIsCountingActive(true)}
                        disabled={state.cellTypes.length === 0}
                      >
                        Start Counting
                      </Button>
                      {state.cellTypes.length === 0 && (
                        <p className="text-sm text-muted-foreground mt-2">
                          Add cell types first to start counting
                        </p>
                      )}
                      {totalCount > 0 && (
                        <Button
                          variant="outline"
                          onClick={() => resetCounts()}
                          className="mt-4"
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Reset Counts
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Active Counting Display - Mobile Optimized */}
                      <div className="grid gap-2 md:gap-3 grid-cols-2 lg:grid-cols-3">
                        {state.cellTypes.map((cell) => (
                          <button
                            key={cell.id}
                            className="w-full p-1.5 md:p-3 border rounded-lg hover:bg-muted/50 transition-colors bg-card text-left"
                            onClick={() => incrementCell(cell.key)}
                            disabled={isComplete}
                          >
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1 pr-1">
                                <div className="font-medium text-xs leading-none sm:leading-tight break-words">{cell.name}</div>
                                <div className="text-xs text-muted-foreground hidden md:block">
                                  Press "{cell.key}"
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg md:text-xl font-bold">{cell.count}</div>
                                <div className="text-xs text-muted-foreground">
                                  {totalCount > 0 ? ((cell.count / totalCount) * 100).toFixed(1) : '0.0'}%
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                        
                        {/* M:E Ratio Card - Non-interactable */}
                        {isPBBMPreset && meRatio && (
                          <div className="w-full p-1.5 md:p-3 border rounded-lg bg-accent/50 text-left cursor-default">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1 pr-1">
                                <div className="font-medium text-xs leading-none sm:leading-tight break-words">M:E Ratio</div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-lg md:text-xl font-bold">{meRatio.ratio}:1</div>
                                <div className="text-xs text-muted-foreground">
                                  {meRatio.myeloidCount}:{meRatio.erythroidCount}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>


                      {/* Progress Bar */}
                      {state.settings.enableLimit && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progress</span>
                            <span>{totalCount} / {state.settings.countLimit}</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                isComplete ? 'bg-emerald-600' : 'bg-primary'
                              }`}
                              style={{
                                width: `${Math.min((totalCount / state.settings.countLimit) * 100, 100)}%`
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Control Buttons */}
                      <div className="flex flex-wrap gap-2 justify-center">
                        <Button
                          variant="outline"
                          onClick={undoLastAction}
                          disabled={state.undoHistory.length === 0}
                          size="sm"
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Undo
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            resetCounts()
                            setIsCountingActive(false)
                          }}
                          disabled={totalCount === 0}
                          size="sm"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Reset
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => exportResults('text')}
                          disabled={totalCount === 0}
                          size="sm"
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Copy
                        </Button>
                      </div>


                      {/* Keyboard Instructions - Desktop only */}
                      <div className="border-t pt-6 mt-4 hidden md:block">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">
                            <strong>Instructions:</strong> <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">Ctrl+Z</kbd> or <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">Backspace</kbd> to undo, and <kbd className="px-3 py-2 bg-background border border-gray-300 rounded-lg text-xs font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] hover:shadow-[0_1px_0_0_rgb(0,0,0,0.1)] active:shadow-[0_0px_0_0_rgb(0,0,0,0.1)] transition-all">Shift+key</kbd> to decrement
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Keyboard Visualizer - Always visible */}
              <KeyboardVisualizer cellTypes={state.cellTypes} />
            </div>
          </div>
        </div>
      </section>

      {/* Join Community Section */}
      <JoinCommunitySection />
    </div>
  )
}
