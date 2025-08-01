// src/features/debug/components/database-functions-panel.tsx
/**
 * Database Functions Panel - Shows all database functions and procedures
 */

'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import {
  Code as FunctionIcon,
  ChevronDown,
  ChevronRight,
  Shield,
  Code,
  RefreshCw,
  Zap
} from 'lucide-react'

interface DatabaseFunction {
  routine_name: string
  routine_type: 'FUNCTION' | 'PROCEDURE'
  data_type: string | null
  security_type: 'DEFINER' | 'INVOKER'
  routine_definition?: string
  security_mode?: string
  parameter_names?: string[]
  parameter_types?: string[]
  parameters?: string[]
  description?: string
  purpose?: string
  inputs?: Array<{
    name?: string
    type: string
    description: string
  }>
  outputs?: Array<{
    type: string
    description: string
  }>
  usage_example?: string
  side_effects?: string
  parameter_count?: number
  function_comment?: string
}

interface DatabaseFunctionsPanelProps {
  data: DatabaseFunction[]
  searchQuery: string
  loading: boolean
  onRefresh: () => void
}

export function DatabaseFunctionsPanel({ 
  data, 
  searchQuery, 
  loading, 
  onRefresh 
}: DatabaseFunctionsPanelProps) {
  const [expandedFunctions, setExpandedFunctions] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<'all' | 'function' | 'procedure'>('all')
  const [filterSecurity, setFilterSecurity] = useState<'all' | 'definer' | 'invoker'>('all')

  // Filter and sort functions
  const filteredFunctions = useMemo(() => {
    const filtered = data.filter(func => {
      const matchesSearch = func.routine_name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesType = filterType === 'all' || func.routine_type.toLowerCase() === filterType
      const matchesSecurity = filterSecurity === 'all' || func.security_type.toLowerCase() === filterSecurity
      
      return matchesSearch && matchesType && matchesSecurity
    })

    return filtered.sort((a, b) => {
      // Sort by type first (functions before procedures), then by name
      if (a.routine_type !== b.routine_type) {
        return a.routine_type === 'FUNCTION' ? -1 : 1
      }
      return a.routine_name.localeCompare(b.routine_name)
    })
  }, [data, searchQuery, filterType, filterSecurity])

  const toggleFunctionExpansion = (functionName: string) => {
    const newExpanded = new Set(expandedFunctions)
    if (newExpanded.has(functionName)) {
      newExpanded.delete(functionName)
    } else {
      newExpanded.add(functionName)
    }
    setExpandedFunctions(newExpanded)
  }

  const getSecurityBadgeColor = (securityType: string) => {
    return securityType === 'DEFINER' 
      ? 'bg-red-100 text-red-800' 
      : 'bg-green-100 text-green-800'
  }

  const getTypeBadgeColor = (routineType: string) => {
    return routineType === 'FUNCTION' 
      ? 'bg-blue-100 text-blue-800' 
      : 'bg-purple-100 text-purple-800'
  }

  const getReturnTypeBadge = (dataType: string | null) => {
    if (!dataType) return null
    
    let color = 'bg-gray-100 text-gray-800'
    if (dataType === 'trigger') color = 'bg-orange-100 text-orange-800'
    else if (dataType.includes('uuid')) color = 'bg-purple-100 text-purple-800'
    else if (dataType === 'boolean') color = 'bg-yellow-100 text-yellow-800'
    else if (dataType === 'void') color = 'bg-gray-100 text-gray-600'
    
    return (
      <Badge className={color}>
        {dataType}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading functions...</span>
      </div>
    )
  }

  const functionCount = filteredFunctions.filter(f => f.routine_type === 'FUNCTION').length
  const procedureCount = filteredFunctions.filter(f => f.routine_type === 'PROCEDURE').length

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <FunctionIcon className="h-5 w-5 text-gray-500" />
            <span className="font-medium">
              {filteredFunctions.length} total ({functionCount} functions, {procedureCount} procedures)
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedFunctions(new Set())}
          >
            Collapse All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedFunctions(new Set(filteredFunctions.map((f, i) => `${f.routine_name}-${f.routine_type}.${i}`)))}
          >
            Expand All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Type:</span>
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('all')}
          >
            All
          </Button>
          <Button
            variant={filterType === 'function' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('function')}
          >
            Functions
          </Button>
          <Button
            variant={filterType === 'procedure' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterType('procedure')}
          >
            Procedures
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Security:</span>
          <Button
            variant={filterSecurity === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSecurity('all')}
          >
            All
          </Button>
          <Button
            variant={filterSecurity === 'definer' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSecurity('definer')}
          >
            Definer
          </Button>
          <Button
            variant={filterSecurity === 'invoker' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterSecurity('invoker')}
          >
            Invoker
          </Button>
        </div>
      </div>

      {/* Functions List */}
      <div className="space-y-3">
        {filteredFunctions.map((func, index) => {
          const functionKey = `${func.routine_name}-${func.routine_type}.${index}`
          const isExpanded = expandedFunctions.has(functionKey)

          return (
            <Card key={functionKey} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleFunctionExpansion(functionKey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    {func.routine_type === 'FUNCTION' ? (
                      <FunctionIcon className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Zap className="h-5 w-5 text-purple-600" />
                    )}
                    <div>
                      <CardTitle className="text-lg">{func.routine_name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {func.routine_type.toLowerCase()} | Security: {func.security_type}
                        {func.parameter_count !== undefined && ` | ${func.parameter_count} param${func.parameter_count !== 1 ? 's' : ''}`}
                      </p>
                      {func.description && (
                        <p className="text-xs text-blue-600 mt-1 italic">
                          {func.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge className={getTypeBadgeColor(func.routine_type)}>
                      {func.routine_type}
                    </Badge>
                    {func.data_type && getReturnTypeBadge(func.data_type)}
                    {func.parameter_count !== undefined && (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        {func.parameter_count} param{func.parameter_count !== 1 ? 's' : ''}
                      </Badge>
                    )}
                    <Badge className={getSecurityBadgeColor(func.security_type)}>
                      <Shield className="h-3 w-3 mr-1" />
                      {func.security_type}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-6">
                    {/* Function Overview */}
                    <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                      <h4 className="font-medium text-sm mb-2 text-blue-800">Purpose</h4>
                      <p className="text-sm text-blue-700">
                        {func.purpose || func.description || 'No description available'}
                      </p>
                    </div>

                    {/* Function Details */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-sm mb-2">Return Type</h4>
                        <p className="text-sm text-gray-600 font-mono">
                          {func.data_type || 'void'}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2">Security Mode</h4>
                        <p className="text-sm text-gray-600">
                          {func.security_mode || func.security_type}
                        </p>
                      </div>
                    </div>

                    {/* Inputs */}
                    {func.inputs && func.inputs.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3 flex items-center">
                          <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                          Inputs
                        </h4>
                        <div className="space-y-3">
                          {func.inputs.map((input, index) => (
                            <div key={index} className="p-3 bg-green-50 rounded-lg border-l-2 border-green-200">
                              <div className="flex items-center space-x-2 mb-1">
                                {input.name && (
                                  <Badge variant="outline" className="font-mono text-xs bg-white">
                                    {input.name}
                                  </Badge>
                                )}
                                <Badge className="bg-green-100 text-green-800 text-xs">
                                  {input.type}
                                </Badge>
                              </div>
                              <p className="text-xs text-green-700">{input.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Outputs */}
                    {func.outputs && func.outputs.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm mb-3 flex items-center">
                          <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                          Outputs
                        </h4>
                        <div className="space-y-3">
                          {func.outputs.map((output, index) => (
                            <div key={index} className="p-3 bg-blue-50 rounded-lg border-l-2 border-blue-200">
                              <div className="flex items-center space-x-2 mb-1">
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

                    {/* Fallback Parameters (for functions without detailed input/output info) */}
                    {!func.inputs && ((func.parameters && func.parameters.length > 0) || (func.parameter_names && func.parameter_names.length > 0)) && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Parameters</h4>
                        <div className="space-y-2">
                          {func.parameters ? (
                            func.parameters.map((param: any, index: number) => (
                              <div key={index} className="flex items-center space-x-2 text-sm">
                                <Badge variant="outline" className="font-mono text-xs">
                                  {typeof param === 'object' ? param.parameter_name : param}
                                </Badge>
                                {typeof param === 'object' && param.data_type && (
                                  <span className="text-gray-500 text-xs">{param.data_type}</span>
                                )}
                                {typeof param === 'object' && param.parameter_mode && param.parameter_mode !== 'IN' && (
                                  <Badge variant="secondary" className="text-xs">{param.parameter_mode}</Badge>
                                )}
                              </div>
                            ))
                          ) : (
                            func.parameter_names?.map((param, index) => (
                              <div key={index} className="flex items-center space-x-2 text-sm">
                                <Badge variant="outline">{param}</Badge>
                                <span className="text-gray-600">
                                  {func.parameter_types?.[index] || 'unknown'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Usage Example */}
                    {func.usage_example && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center">
                          <Code className="h-4 w-4 mr-2 text-purple-600" />
                          Usage Example
                        </h4>
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                          <pre className="text-xs">
                            <code className="text-green-400">{func.usage_example}</code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Side Effects */}
                    {func.side_effects && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center">
                          <span className="w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                          Side Effects
                        </h4>
                        <div className="p-3 bg-orange-50 rounded-lg border-l-2 border-orange-200">
                          <p className="text-sm text-orange-700">{func.side_effects}</p>
                        </div>
                      </div>
                    )}

                    {/* Function Definition */}
                    {func.routine_definition && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">SQL Definition</h4>
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                          <pre className="text-xs">
                            <code>{func.routine_definition}</code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Comment */}
                    {func.function_comment && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Additional Notes</h4>
                        <p className="text-sm text-gray-600 italic">
                          {func.function_comment}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {filteredFunctions.length === 0 && (
        <div className="text-center py-12">
          <FunctionIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchQuery ? 'No functions match your search.' : 'No functions found.'}
          </p>
        </div>
      )}
    </div>
  )
}
