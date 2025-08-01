// src/features/debug/components/database-triggers-panel.tsx
/**
 * Database Triggers Panel - Shows all database triggers with their configurations
 */

'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { 
  Zap, 
  ChevronDown, 
  ChevronRight, 
  Table,
  RefreshCw,
  Clock,
  Target
} from 'lucide-react'

interface DatabaseTrigger {
  trigger_name: string
  event_manipulation: string
  event_object_table: string
  action_statement: string
  action_timing: string
  action_orientation?: string
  trigger_comment?: string
  description?: string
}

interface DatabaseTriggersPanelProps {
  data: DatabaseTrigger[]
  searchQuery: string
  loading: boolean
  onRefresh: () => void
}

export function DatabaseTriggersPanel({ 
  data, 
  searchQuery, 
  loading, 
  onRefresh 
}: DatabaseTriggersPanelProps) {
  const [expandedTriggers, setExpandedTriggers] = useState<Set<string>>(new Set())
  const [filterEvent, setFilterEvent] = useState<'all' | 'INSERT' | 'UPDATE' | 'DELETE'>('all')
  const [filterTiming, setFilterTiming] = useState<'all' | 'BEFORE' | 'AFTER'>('all')

  // Filter and sort triggers
  const filteredTriggers = useMemo(() => {
    const filtered = data.filter(trigger => {
      const matchesSearch = 
        trigger.trigger_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trigger.event_object_table.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesEvent = filterEvent === 'all' || trigger.event_manipulation === filterEvent
      const matchesTiming = filterTiming === 'all' || trigger.action_timing === filterTiming
      
      return matchesSearch && matchesEvent && matchesTiming
    })

    return filtered.sort((a, b) => {
      // Sort by table first, then by trigger name
      if (a.event_object_table !== b.event_object_table) {
        return a.event_object_table.localeCompare(b.event_object_table)
      }
      return a.trigger_name.localeCompare(b.trigger_name)
    })
  }, [data, searchQuery, filterEvent, filterTiming])

  const toggleTriggerExpansion = (triggerName: string) => {
    const newExpanded = new Set(expandedTriggers)
    if (newExpanded.has(triggerName)) {
      newExpanded.delete(triggerName)
    } else {
      newExpanded.add(triggerName)
    }
    setExpandedTriggers(newExpanded)
  }

  const getEventBadgeColor = (event: string) => {
    switch (event) {
      case 'INSERT': return 'bg-green-100 text-green-800'
      case 'UPDATE': return 'bg-blue-100 text-blue-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTimingBadgeColor = (timing: string) => {
    return timing === 'BEFORE' 
      ? 'bg-orange-100 text-orange-800' 
      : 'bg-purple-100 text-purple-800'
  }

  const formatActionStatement = (statement: string) => {
    // Basic formatting for trigger action statements
    return statement
      .replace(/EXECUTE FUNCTION/gi, 'EXECUTE FUNCTION')
      .replace(/\(\)/g, '()')
      .trim()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading triggers...</span>
      </div>
    )
  }

  // Group triggers by table for summary
  const triggersByTable = filteredTriggers.reduce((acc, trigger) => {
    const table = trigger.event_object_table
    if (!acc[table]) acc[table] = []
    acc[table].push(trigger)
    return acc
  }, {} as Record<string, DatabaseTrigger[]>)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-gray-500" />
            <span className="font-medium">
              {filteredTriggers.length} trigger{filteredTriggers.length !== 1 ? 's' : ''} 
              on {Object.keys(triggersByTable).length} table{Object.keys(triggersByTable).length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedTriggers(new Set())}
          >
            Collapse All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedTriggers(new Set(filteredTriggers.map((t, i) => `${t.event_object_table}.${t.trigger_name}.${i}`)))}
          >
            Expand All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Event:</span>
          <Button
            variant={filterEvent === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterEvent('all')}
          >
            All
          </Button>
          <Button
            variant={filterEvent === 'INSERT' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterEvent('INSERT')}
          >
            INSERT
          </Button>
          <Button
            variant={filterEvent === 'UPDATE' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterEvent('UPDATE')}
          >
            UPDATE
          </Button>
          <Button
            variant={filterEvent === 'DELETE' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterEvent('DELETE')}
          >
            DELETE
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Timing:</span>
          <Button
            variant={filterTiming === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterTiming('all')}
          >
            All
          </Button>
          <Button
            variant={filterTiming === 'BEFORE' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterTiming('BEFORE')}
          >
            BEFORE
          </Button>
          <Button
            variant={filterTiming === 'AFTER' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterTiming('AFTER')}
          >
            AFTER
          </Button>
        </div>
      </div>

      {/* Triggers List */}
      <div className="space-y-3">
        {filteredTriggers.map((trigger, index) => {
          const triggerKey = `${trigger.event_object_table}.${trigger.trigger_name}.${index}`
          const isExpanded = expandedTriggers.has(triggerKey)

          return (
            <Card key={triggerKey} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleTriggerExpansion(triggerKey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <Zap className="h-5 w-5 text-yellow-600" />
                    <div>
                      <CardTitle className="text-lg font-mono">{trigger.trigger_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {trigger.action_timing} {trigger.event_manipulation} on {trigger.event_object_table}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {trigger.event_object_table}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {trigger.event_manipulation}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Essential Info */}
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Table:</span> {trigger.event_object_table}
                        </div>
                        <div>
                          <span className="font-medium">Event:</span> {trigger.event_manipulation}
                        </div>
                        <div>
                          <span className="font-medium">Timing:</span> {trigger.action_timing}
                        </div>
                        <div>
                          <span className="font-medium">Level:</span> {trigger.action_orientation || 'ROW'}
                        </div>
                      </div>
                    </div>

                    {/* Function */}
                    <div>
                      <h4 className="font-medium text-sm mb-2">Function</h4>
                      <div className="p-2 bg-gray-100 rounded font-mono text-sm">
                        {trigger.action_statement}
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {filteredTriggers.length === 0 && (
        <div className="text-center py-12">
          <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchQuery ? 'No triggers match your search.' : 'No triggers found.'}
          </p>
        </div>
      )}
    </div>
  )
}
