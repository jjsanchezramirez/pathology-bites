'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
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
  { id: '1', name: 'Neutrophils', key: 'n', count: 0, color: 'bg-blue-500' },
  { id: '2', name: 'Lymphocytes', key: 'l', count: 0, color: 'bg-green-500' },
  { id: '3', name: 'Monocytes', key: 'm', count: 0, color: 'bg-purple-500' },
  { id: '4', name: 'Eosinophils', key: 'e', count: 0, color: 'bg-red-500' },
  { id: '5', name: 'Basophils', key: 'b', count: 0, color: 'bg-yellow-500' }
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
      console.error('Failed to load saved state:', error)
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
      console.error('Failed to save state:', error)
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
    if (!newCellName.trim() || !newCellKey.trim()) {
      toast.error('Please enter both cell name and key')
      return
    }

    if (state.cellTypes.length >= 20) {
      toast.error('Maximum 20 cell types allowed')
      return
    }

    const keyExists = state.cellTypes.some(cell => cell.key.toLowerCase() === newCellKey.toLowerCase())
    if (keyExists) {
      toast.error('Key already in use')
      return
    }

    const colors = [
      'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500', 'bg-yellow-500',
      'bg-indigo-500', 'bg-pink-500', 'bg-teal-500', 'bg-orange-500', 'bg-cyan-500'
    ]
    
    const newCell: CellType = {
      id: Date.now().toString(),
      name: newCellName.trim(),
      key: newCellKey.toLowerCase().trim(),
      count: 0,
      color: colors[state.cellTypes.length % colors.length]
    }

    updateState(prev => ({
      ...prev,
      cellTypes: [...prev.cellTypes, newCell]
    }))

    setNewCellName('')
    setNewCellKey('')
    toast.success(`Added ${newCell.name} (${newCell.key})`)
  }, [newCellName, newCellKey, state.cellTypes, updateState])

  // Remove cell type
  const removeCellType = useCallback((id: string) => {
    updateState(prev => ({
      ...prev,
      cellTypes: prev.cellTypes.filter(cell => cell.id !== id)
    }))
    toast.success('Cell type removed')
  }, [updateState])

  // Increment cell count
  const incrementCell = useCallback((key: string) => {
    if (isComplete) {
      toast.warning('Count limit reached!')
      return
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

    // Visual feedback
    const cellName = state.cellTypes[cellIndex].name
    toast.success(`${cellName}: ${state.cellTypes[cellIndex].count + 1}`, {
      duration: 1000
    })
  }, [state.cellTypes, state.settings, isComplete, updateState])

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

    toast.success('Undone last action')
  }, [state.undoHistory, updateState])

  // Reset all counts
  const resetCounts = useCallback(() => {
    updateState(prev => ({
      ...prev,
      cellTypes: prev.cellTypes.map(cell => ({ ...cell, count: 0 })),
      undoHistory: []
    }))
    toast.success('All counts reset')
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

      // Check if it's a cell type key
      const cellExists = state.cellTypes.some(cell => cell.key === key)
      if (cellExists) {
        event.preventDefault()
        incrementCell(key)
        return
      }

      // Handle special keys
      switch (key) {
        case 'escape':
          event.preventDefault()
          setIsCountingActive(false)
          toast.info('Counting stopped')
          break
        case 'z':
          if (event.ctrlKey || event.metaKey) {
            event.preventDefault()
            undoLastAction()
          }
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
  }, [isCountingActive, state.cellTypes, incrementCell, undoLastAction, resetCounts, exportResults])

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
      <section className="relative py-8">
        <div className="container mx-auto px-4 max-w-6xl" ref={containerRef}>
          <div className="grid gap-6 lg:grid-cols-3">
            
            {/* Simplified Setup Panel */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Quick Setup
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
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
                          toast.success('Differential count preset loaded')
                        }}
                        disabled={isCountingActive}
                        className="justify-start"
                      >
                        🩸 Differential Count (100 cells)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const mitoticCells = [
                            { id: '1', name: 'Mitotic Figures', key: 'm', count: 0, color: 'bg-blue-500' },
                            { id: '2', name: 'Normal Cells', key: 'n', count: 0, color: 'bg-green-500' }
                          ]
                          updateState(prev => ({
                            ...prev,
                            cellTypes: mitoticCells,
                            settings: { ...DEFAULT_SETTINGS, countLimit: 1000, enableLimit: true }
                          }))
                          toast.success('Mitotic count preset loaded')
                        }}
                        disabled={isCountingActive}
                        className="justify-start"
                      >
                        🔬 Mitotic Count (1000 cells)
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          updateState(prev => ({
                            ...prev,
                            cellTypes: [],
                            settings: { ...DEFAULT_SETTINGS, enableLimit: false }
                          }))
                          toast.success('Custom setup ready')
                        }}
                        disabled={isCountingActive}
                        className="justify-start"
                      >
                        ⚙️ Custom Setup
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
                        className="w-16"
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
                      <div className="grid gap-1 max-h-48 overflow-y-auto">
                        {state.cellTypes.map((cell) => (
                          <div key={cell.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${cell.color}`} />
                              <span className="text-sm">{cell.name}</span>
                              <Badge variant="secondary" className="text-xs px-1">
                                {cell.key}
                              </Badge>
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
                          cellTypes: DEFAULT_CELL_TYPES,
                          settings: DEFAULT_SETTINGS,
                          undoHistory: []
                        }))
                        toast.success('Reset to defaults')
                      }}
                      disabled={isCountingActive}
                      className="w-full"
                      size="sm"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Reset All
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Counting Interface */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Cell Counter
                      {isCountingActive && (
                        <Badge variant="default" className="ml-2">
                          Active
                        </Badge>
                      )}
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
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Active Counting Display */}
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {state.cellTypes.map((cell) => (
                          <div
                            key={cell.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full ${cell.color}`} />
                              <div>
                                <div className="font-medium text-sm">{cell.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  Press "{cell.key}"
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold">{cell.count}</div>
                              {totalCount > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {((cell.count / totalCount) * 100).toFixed(1)}%
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
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
                                isComplete ? 'bg-green-500' : 'bg-primary'
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
                          onClick={() => setIsCountingActive(false)}
                        >
                          Stop Counting
                        </Button>
                        <Button
                          variant="outline"
                          onClick={undoLastAction}
                          disabled={state.undoHistory.length === 0}
                        >
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Undo
                        </Button>
                        <Button
                          variant="outline"
                          onClick={resetCounts}
                          disabled={totalCount === 0}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Reset
                        </Button>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            onClick={() => exportResults('text')}
                            disabled={totalCount === 0}
                            size="sm"
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Table
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => exportResults('rtf')}
                            disabled={totalCount === 0}
                            size="sm"
                          >
                            📄 RTF
                          </Button>
                        </div>
                      </div>

                      {/* Keyboard Shortcuts Help - Simplified */}
                      <div className="bg-muted/50 rounded-lg p-3">
                        <h4 className="font-medium mb-2 text-sm">Quick Keys:</h4>
                        <div className="grid gap-1 text-xs text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Count cells:</span>
                            <span className="flex gap-1">
                              {state.cellTypes.slice(0, 4).map((cell) => (
                                <kbd key={cell.id} className="px-1 bg-background border rounded">
                                  {cell.key}
                                </kbd>
                              ))}
                              {state.cellTypes.length > 4 && <span>...</span>}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Undo:</span>
                            <kbd className="px-1 bg-background border rounded">Ctrl+Z</kbd>
                          </div>
                          <div className="flex justify-between">
                            <span>Copy table:</span>
                            <kbd className="px-1 bg-background border rounded">Ctrl+C</kbd>
                          </div>
                          <div className="flex justify-between">
                            <span>Stop:</span>
                            <kbd className="px-1 bg-background border rounded">Esc</kbd>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Join Community Section */}
      <JoinCommunitySection />
    </div>
  )
}
