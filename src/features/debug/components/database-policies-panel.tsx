// src/features/debug/components/database-policies-panel.tsx
/**
 * Database Policies Panel - Shows all RLS policies with their configurations
 */

'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { 
  Shield, 
  ChevronDown, 
  ChevronRight, 
  Table,
  RefreshCw,
  Users,
  Lock,
  Eye,
  Edit,
  Trash2,
  Plus
} from 'lucide-react'

interface DatabasePolicy {
  schemaname: string
  tablename: string
  policyname: string
  permissive: string
  roles: string[]
  cmd: string
  qual: string | null
  with_check: string | null
}

interface DatabasePoliciesPanelProps {
  data: DatabasePolicy[]
  searchQuery: string
  loading: boolean
  onRefresh: () => void
}

export function DatabasePoliciesPanel({ 
  data, 
  searchQuery, 
  loading, 
  onRefresh 
}: DatabasePoliciesPanelProps) {
  const [expandedPolicies, setExpandedPolicies] = useState<Set<string>>(new Set())
  const [filterCommand, setFilterCommand] = useState<'all' | 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'>('all')
  const [filterPermissive, setFilterPermissive] = useState<'all' | 'PERMISSIVE' | 'RESTRICTIVE'>('all')

  // Filter and sort policies
  const filteredPolicies = useMemo(() => {
    const filtered = data.filter(policy => {
      const matchesSearch = 
        policy.policyname.toLowerCase().includes(searchQuery.toLowerCase()) ||
        policy.tablename.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCommand = filterCommand === 'all' || policy.cmd === filterCommand
      const matchesPermissive = filterPermissive === 'all' || policy.permissive === filterPermissive
      
      return matchesSearch && matchesCommand && matchesPermissive
    })

    return filtered.sort((a, b) => {
      // Sort by table first, then by policy name
      if (a.tablename !== b.tablename) {
        return a.tablename.localeCompare(b.tablename)
      }
      return a.policyname.localeCompare(b.policyname)
    })
  }, [data, searchQuery, filterCommand, filterPermissive])

  const togglePolicyExpansion = (policyKey: string) => {
    const newExpanded = new Set(expandedPolicies)
    if (newExpanded.has(policyKey)) {
      newExpanded.delete(policyKey)
    } else {
      newExpanded.add(policyKey)
    }
    setExpandedPolicies(newExpanded)
  }

  const getCommandIcon = (cmd: string) => {
    switch (cmd) {
      case 'SELECT': return <Eye className="h-3 w-3" />
      case 'INSERT': return <Plus className="h-3 w-3" />
      case 'UPDATE': return <Edit className="h-3 w-3" />
      case 'DELETE': return <Trash2 className="h-3 w-3" />
      default: return <Shield className="h-3 w-3" />
    }
  }

  const getCommandBadgeColor = (cmd: string) => {
    switch (cmd) {
      case 'SELECT': return 'bg-blue-100 text-blue-800'
      case 'INSERT': return 'bg-green-100 text-green-800'
      case 'UPDATE': return 'bg-yellow-100 text-yellow-800'
      case 'DELETE': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPermissiveBadgeColor = (permissive: string) => {
    return permissive === 'PERMISSIVE' 
      ? 'bg-green-100 text-green-800' 
      : 'bg-orange-100 text-orange-800'
  }

  const formatPolicyExpression = (expression: string | null) => {
    if (!expression) return 'No condition'
    
    // Basic formatting for policy expressions
    return expression
      .replace(/\s+/g, ' ')
      .replace(/\(\s*/g, '(\n  ')
      .replace(/\s*\)/g, '\n)')
      .replace(/\s+(AND|OR)\s+/gi, '\n$1 ')
      .trim()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">Loading policies...</span>
      </div>
    )
  }

  // Group policies by table for summary
  const policiesByTable = filteredPolicies.reduce((acc, policy) => {
    const table = policy.tablename
    if (!acc[table]) acc[table] = []
    acc[table].push(policy)
    return acc
  }, {} as Record<string, DatabasePolicy[]>)

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-gray-500" />
            <span className="font-medium">
              {filteredPolicies.length} polic{filteredPolicies.length !== 1 ? 'ies' : 'y'} 
              on {Object.keys(policiesByTable).length} table{Object.keys(policiesByTable).length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedPolicies(new Set())}
          >
            Collapse All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedPolicies(new Set(filteredPolicies.map((p, i) => `${p.tablename}-${p.policyname}.${i}`)))}
          >
            Expand All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Command:</span>
          <Button
            variant={filterCommand === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCommand('all')}
          >
            All
          </Button>
          <Button
            variant={filterCommand === 'SELECT' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCommand('SELECT')}
          >
            SELECT
          </Button>
          <Button
            variant={filterCommand === 'INSERT' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCommand('INSERT')}
          >
            INSERT
          </Button>
          <Button
            variant={filterCommand === 'UPDATE' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCommand('UPDATE')}
          >
            UPDATE
          </Button>
          <Button
            variant={filterCommand === 'DELETE' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterCommand('DELETE')}
          >
            DELETE
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">Type:</span>
          <Button
            variant={filterPermissive === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterPermissive('all')}
          >
            All
          </Button>
          <Button
            variant={filterPermissive === 'PERMISSIVE' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterPermissive('PERMISSIVE')}
          >
            Permissive
          </Button>
          <Button
            variant={filterPermissive === 'RESTRICTIVE' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilterPermissive('RESTRICTIVE')}
          >
            Restrictive
          </Button>
        </div>
      </div>

      {/* Policies List */}
      <div className="space-y-3">
        {filteredPolicies.map((policy, index) => {
          const policyKey = `${policy.tablename}-${policy.policyname}.${index}`
          const isExpanded = expandedPolicies.has(policyKey)

          return (
            <Card key={policyKey} className="overflow-hidden">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => togglePolicyExpansion(policyKey)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                    <Shield className="h-5 w-5 text-blue-600" />
                    <div>
                      <CardTitle className="text-lg font-mono">{policy.policyname}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {policy.cmd} on {policy.tablename} • {policy.roles?.join(', ') || 'all roles'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {policy.tablename}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {policy.cmd}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-4">
                    {/* Policy Details */}
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center">
                          <Table className="h-4 w-4 mr-1" />
                          Target Table
                        </h4>
                        <p className="text-sm text-gray-600 font-mono">
                          {policy.schemaname}.{policy.tablename}
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center">
                          <Users className="h-4 w-4 mr-1" />
                          Roles
                        </h4>
                        <div className="flex flex-wrap gap-1">
                          {policy.roles.map((role, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {role}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Policy Expression (USING clause) */}
                    {policy.qual && (
                      <div>
                        <h4 className="font-medium text-sm mb-2 flex items-center">
                          <Lock className="h-4 w-4 mr-1" />
                          Policy Expression (USING)
                        </h4>
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                          <pre className="text-xs">
                            <code>{formatPolicyExpression(policy.qual)}</code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Check Expression (WITH CHECK clause) */}
                    {policy.with_check && (
                      <div>
                        <h4 className="font-medium text-sm mb-2">Check Expression (WITH CHECK)</h4>
                        <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                          <pre className="text-xs">
                            <code>{formatPolicyExpression(policy.with_check)}</code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {/* Policy Summary */}
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-sm mb-2 text-blue-800">Policy Summary</h4>
                      <div className="text-xs text-blue-700 space-y-1">
                        <div>
                          <strong>Effect:</strong> {policy.permissive === 'PERMISSIVE' ? 'Allows' : 'Restricts'} {policy.cmd} operations
                        </div>
                        <div>
                          <strong>Applies to:</strong> {policy.roles.join(', ')} role{policy.roles.length !== 1 ? 's' : ''}
                        </div>
                        <div>
                          <strong>Condition:</strong> {policy.qual ? 'Has USING clause' : 'No conditions'}
                          {policy.with_check && ' + WITH CHECK clause'}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {filteredPolicies.length === 0 && (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">
            {searchQuery ? 'No policies match your search.' : 'No RLS policies found.'}
          </p>
        </div>
      )}
    </div>
  )
}
