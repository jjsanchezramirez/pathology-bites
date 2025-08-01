// src/features/debug/components/database-tables-panel.tsx
/**
 * Database Tables Panel - Shows all database tables with column information
 */

'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Input } from '@/shared/components/ui/input'
import { 
  Table, 
  ChevronDown, 
  ChevronRight, 
  Database,
  Key,
  Hash,
  Type,
  RefreshCw
} from 'lucide-react'

interface DatabaseTable {
  schemaname: string
  tablename: string
  tableowner: string
  row_count?: number
  column_count?: number
  columns?: Array<{
    column_name: string
    data_type: string
    is_nullable: string
    column_default: string | null
    character_maximum_length: number | null
    numeric_precision: number | null
    numeric_scale: number | null
    ordinal_position?: number
  }>
  constraint_count?: number
}

interface DatabaseTablesPanelProps {
  data: DatabaseTable[]
  searchQuery: string
  loading: boolean
  onRefresh: () => void
}

export function DatabaseTablesPanel({ 
  data, 
  searchQuery, 
  loading, 
  onRefresh 
}: DatabaseTablesPanelProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set())
  const [sortBy, setSortBy] = useState<'name' | 'columns'>('name')

  // Filter and sort tables
  const filteredTables = useMemo(() => {
    const filtered = data.filter(table =>
      table.tablename.toLowerCase().includes(searchQuery.toLowerCase()) ||
      table.schemaname.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return a.tablename.localeCompare(b.tablename)
      } else {
        const aColumns = a.columns?.length || 0
        const bColumns = b.columns?.length || 0
        return bColumns - aColumns
      }
    })
  }, [data, searchQuery, sortBy])

  const toggleTableExpansion = (tableName: string) => {
    const newExpanded = new Set(expandedTables)
    if (newExpanded.has(tableName)) {
      newExpanded.delete(tableName)
    } else {
      newExpanded.add(tableName)
    }
    setExpandedTables(newExpanded)
  }

  const getDataTypeIcon = (dataType: string) => {
    if (dataType.includes('uuid') || dataType.includes('id')) return <Key className="h-3 w-3" />
    if (dataType.includes('int') || dataType.includes('numeric')) return <Hash className="h-3 w-3" />
    return <Type className="h-3 w-3" />
  }

  const getDataTypeBadgeColor = (dataType: string) => {
    if (dataType.includes('uuid')) return 'bg-purple-100 text-purple-800'
    if (dataType.includes('text') || dataType.includes('varchar')) return 'bg-blue-100 text-blue-800'
    if (dataType.includes('int') || dataType.includes('numeric')) return 'bg-green-100 text-green-800'
    if (dataType.includes('boolean')) return 'bg-yellow-100 text-yellow-800'
    if (dataType.includes('timestamp')) return 'bg-orange-100 text-orange-800'
    return 'bg-gray-100 text-gray-800'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading tables...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Database className="h-5 w-5 text-gray-500" />
            <span className="font-medium">
              {filteredTables.length} table{filteredTables.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Sort by:</span>
            <Button
              variant={sortBy === 'name' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('name')}
            >
              Name
            </Button>
            <Button
              variant={sortBy === 'columns' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('columns')}
            >
              Columns
            </Button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedTables(new Set())}
          >
            Collapse All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedTables(new Set(filteredTables.map((t, i) => `${t.schemaname}.${t.tablename}.${i}`)))}
          >
            Expand All
          </Button>
        </div>
      </div>

      {/* Tables List */}
      <div className="space-y-3">
        {filteredTables.map((table, index) => {
          const tableKey = `${table.schemaname}.${table.tablename}.${index}`
          const isExpanded = expandedTables.has(tableKey)
          const columnCount = table.columns?.length || 0

          return (
            <Card key={tableKey} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleTableExpansion(tableKey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <Table className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg font-mono">{table.tablename}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {columnCount} columns • {table.row_count?.toLocaleString() || 0} rows • {(((table as any).size_bytes || 0) / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {(table as any).table_type || 'TABLE'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && table.columns && (
                <CardContent className="pt-0">
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b">
                      <div className="grid grid-cols-12 gap-4 text-sm font-medium text-gray-700">
                        <div className="col-span-3">Column Name</div>
                        <div className="col-span-2">Data Type</div>
                        <div className="col-span-1">Nullable</div>
                        <div className="col-span-3">Default Value</div>
                        <div className="col-span-3">Constraints</div>
                      </div>
                    </div>
                    <div className="divide-y">
                      {table.columns.map((column, index) => (
                        <div key={index} className="px-4 py-3 hover:bg-gray-50">
                          <div className="grid grid-cols-12 gap-4 text-sm">
                            <div className="col-span-3 flex items-center space-x-2">
                              {getDataTypeIcon(column.data_type)}
                              <span className="font-medium">{column.column_name}</span>
                            </div>
                            <div className="col-span-2">
                              <Badge className={getDataTypeBadgeColor(column.data_type)}>
                                {column.data_type}
                              </Badge>
                            </div>
                            <div className="col-span-1">
                              <Badge variant={column.is_nullable === 'YES' ? 'secondary' : 'destructive'}>
                                {column.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'}
                              </Badge>
                            </div>
                            <div className="col-span-3 text-gray-600 font-mono text-xs">
                              {column.column_default || '-'}
                            </div>
                            <div className="col-span-3">
                              <div className="flex flex-wrap gap-1">
                                {column.column_name === 'id' && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">PK</Badge>
                                )}
                                {column.column_name.endsWith('_id') && column.column_name !== 'id' && (
                                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">FK</Badge>
                                )}
                                {column.column_name.includes('email') && (
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700">UNIQUE</Badge>
                                )}
                                {column.character_maximum_length && (
                                  <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
                                    Max: {column.character_maximum_length}
                                  </Badge>
                                )}
                                {column.numeric_precision && (
                                  <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600">
                                    Precision: {column.numeric_precision}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {filteredTables.length === 0 && (
        <div className="text-center py-12">
          <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchQuery ? 'No tables match your search.' : 'No tables found.'}
          </p>
        </div>
      )}
    </div>
  )
}
