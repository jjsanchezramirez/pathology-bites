// src/features/debug/components/database-views-panel.tsx
/**
 * Database Views Panel - Shows all database views with their definitions
 */

'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { 
  Eye, 
  ChevronDown, 
  ChevronRight, 
  Code,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react'
import { toast } from '@/shared/utils/toast'

interface DatabaseView {
  view_name: string
  view_schema?: string
  view_definition: string
  view_comment?: string
  description?: string
  purpose?: string
  data_sources?: string[]
  outputs?: Array<{
    column: string
    type: string
    description: string
  }>
  usage?: string
  estimated_rows?: number
  columns?: Array<{
    column_name: string
    data_type: string
    ordinal_position: number
  }>
  column_count?: number
}

interface DatabaseViewsPanelProps {
  data: DatabaseView[]
  searchQuery: string
  loading: boolean
  onRefresh: () => void
}

export function DatabaseViewsPanel({
  data,
  searchQuery,
  loading,
  onRefresh
}: DatabaseViewsPanelProps) {
  const [expandedViews, setExpandedViews] = useState<Set<string>>(new Set())
  const [copiedView, setCopiedView] = useState<string | null>(null)
  const [sampleData, setSampleData] = useState<Record<string, any[]>>({})
  const [loadingSample, setLoadingSample] = useState<Set<string>>(new Set())

  // Filter and sort views
  const filteredViews = useMemo(() => {
    const filtered = data.filter(view =>
      view.view_name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return filtered.sort((a, b) => a.view_name.localeCompare(b.view_name))
  }, [data, searchQuery])

  const toggleViewExpansion = (viewName: string) => {
    const newExpanded = new Set(expandedViews)
    if (newExpanded.has(viewName)) {
      newExpanded.delete(viewName)
    } else {
      newExpanded.add(viewName)
    }
    setExpandedViews(newExpanded)
  }

  const copyViewDefinition = async (viewName: string, definition: string) => {
    try {
      await navigator.clipboard.writeText(definition)
      setCopiedView(viewName)
      toast.success('View definition copied to clipboard')
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedView(null), 2000)
    } catch (error) {
      toast.error('Failed to copy to clipboard')
    }
  }

  const formatViewDefinition = (definition: string) => {
    // Basic SQL formatting - add line breaks after common keywords
    return definition
      .replace(/\s+/g, ' ') // Normalize whitespace
      .replace(/(SELECT|FROM|WHERE|JOIN|LEFT JOIN|RIGHT JOIN|INNER JOIN|GROUP BY|ORDER BY|HAVING|UNION)/gi, '\n$1')
      .replace(/,\s*(?=[a-zA-Z])/g, ',\n    ') // Add line breaks after commas
      .trim()
  }

  const getViewTypeFromName = (viewName: string) => {
    if (viewName.startsWith('v_')) {
      const type = viewName.substring(2).split('_')[0]
      return type.charAt(0).toUpperCase() + type.slice(1)
    }
    return 'View'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading views...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Eye className="h-5 w-5 text-gray-500" />
            <span className="font-medium">
              {filteredViews.length} view{filteredViews.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedViews(new Set())}
          >
            Collapse All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedViews(new Set(filteredViews.map((v, i) => `${v.view_schema || 'public'}.${v.view_name}.${i}`)))}
          >
            Expand All
          </Button>
        </div>
      </div>

      {/* Views List */}
      <div className="space-y-3">
        {filteredViews.map((view, index) => {
          const viewKey = `${view.view_schema || 'public'}.${view.view_name}.${index}`
          const isExpanded = expandedViews.has(viewKey)
          const viewType = getViewTypeFromName(view.view_name)
          const isCopied = copiedView === viewKey

          return (
            <Card key={viewKey} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleViewExpansion(viewKey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <Eye className="h-5 w-5 text-green-600" />
                    <div>
                      <CardTitle className="text-lg">{view.view_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Database view | Type: {viewType}
                        {view.estimated_rows !== undefined && ` | ${view.estimated_rows.toLocaleString()} rows`}
                        {view.column_count && ` | ${view.column_count} columns`}
                      </p>
                      {view.description && (
                        <p className="text-xs text-blue-600 mt-1 italic">
                          {view.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary">
                      <Eye className="h-3 w-3 mr-1" />
                      VIEW
                    </Badge>
                    {view.column_count && (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {view.column_count} columns
                      </Badge>
                    )}
                    {view.estimated_rows !== undefined && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700">
                        {view.estimated_rows.toLocaleString()} rows
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        copyViewDefinition(viewKey, view.view_definition)
                      }}
                      className="h-8 w-8 p-0"
                    >
                      {isCopied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-6">
                    {/* View Purpose */}
                    {view.purpose && (
                      <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                        <h4 className="font-medium text-sm mb-2 text-blue-800">Purpose</h4>
                        <p className="text-sm text-blue-700">{view.purpose}</p>
                      </div>
                    )}

                    {/* Data Sources */}
                    {view.data_sources && view.data_sources.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                          Data Sources
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {view.data_sources.map((source, index) => (
                            <Badge key={index} variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {source}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* View Comment (fallback) */}
                    {!view.purpose && view.view_comment && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <h4 className="font-medium text-sm mb-1">Description</h4>
                        <p className="text-sm text-blue-800">{view.view_comment}</p>
                      </div>
                    )}

                    {/* View Statistics */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-sm mb-1">View Name</h4>
                        <p className="text-sm text-gray-600 font-mono">{view.view_name}</p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-1">Columns</h4>
                        <p className="text-sm text-gray-600">
                          {view.column_count || view.columns?.length || 'Unknown'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-1">Estimated Rows</h4>
                        <p className="text-sm text-gray-600">
                          {view.estimated_rows !== undefined ? view.estimated_rows.toLocaleString() : 'Unknown'}
                        </p>
                      </div>
                    </div>

                    {/* Detailed Outputs */}
                    {view.outputs && view.outputs.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3 flex items-center">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                          Output Columns
                        </h4>
                        <div className="space-y-3">
                          {view.outputs.map((output, index) => (
                            <div key={index} className="p-3 bg-blue-50 rounded-lg border-l-2 border-blue-200">
                              <div className="flex items-center space-x-2 mb-1">
                                <Badge variant="outline" className="font-mono text-xs bg-white">
                                  {output.column}
                                </Badge>
                                <Badge className="bg-blue-100 text-blue-800 text-xs">
                                  {output.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-blue-700">{output.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fallback Columns Information */}
                    {!view.outputs && view.columns && view.columns.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Columns</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {view.columns.map((column, index) => (
                            <div key={index} className="flex items-center space-x-2 p-2 bg-gray-50 rounded text-sm">
                              <span className="font-medium">{column.column_name}</span>
                              <Badge variant="outline" className="text-xs">
                                {column.data_type}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Usage Information */}
                    {view.usage && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center">
                          <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
                          Usage
                        </h4>
                        <div className="p-3 bg-purple-50 rounded-lg border-l-2 border-purple-200">
                          <p className="text-sm text-purple-700">{view.usage}</p>
                        </div>
                      </div>
                    )}

                    {/* View Definition */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-sm">SQL Definition</h4>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyViewDefinition(viewKey, view.view_definition)}
                          className="flex items-center space-x-1"
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                        <pre className="text-xs">
                          <code>{formatViewDefinition(view.view_definition)}</code>
                        </pre>
                      </div>
                    </div>

                    {/* Usage Hints */}
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <h4 className="font-medium text-sm mb-1 text-yellow-800">Usage</h4>
                      <p className="text-xs text-yellow-700 font-mono">
                        SELECT * FROM {view.view_name};
                      </p>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {filteredViews.length === 0 && (
        <div className="text-center py-12">
          <Eye className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchQuery ? 'No views match your search.' : 'No views found.'}
          </p>
        </div>
      )}
    </div>
  )
}
