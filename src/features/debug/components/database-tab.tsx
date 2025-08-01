// src/features/debug/components/database-tab.tsx
/**
 * Database Tab - Wrapper for the database schema inspector
 */

'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/shared/components/ui/input'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { 
  Database, 
  Table, 
  Code as FunctionIcon, 
  Eye, 
  Zap, 
  RefreshCw, 
  Search,
  Shield
} from 'lucide-react'
import { toast } from '@/shared/utils/toast'

// Import the existing database panel components
import { DatabaseTablesPanel } from './database-tables-panel'
import { DatabaseFunctionsPanel } from './database-functions-panel'
import { DatabaseViewsPanel } from './database-views-panel'
import { DatabaseTriggersPanel } from './database-triggers-panel'
import { DatabasePoliciesPanel } from './database-policies-panel'

interface DatabaseSchemaState {
  tables: any[]
  functions: any[]
  views: any[]
  triggers: any[]
  policies: any[]
  indexes: any[]
  loading: boolean
  lastRefresh: string
  error: string | null
}

export function DatabaseTab() {
  const [activeTab, setActiveTab] = useState('tables')
  const [searchQuery, setSearchQuery] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [refreshInterval, setRefreshInterval] = useState(30) // seconds
  
  const [schemaState, setSchemaState] = useState<DatabaseSchemaState>({
    tables: [],
    functions: [],
    views: [],
    triggers: [],
    policies: [],
    indexes: [],
    loading: true,
    lastRefresh: '',
    error: null
  })

  const fetchDatabaseSchema = async () => {
    try {
      setSchemaState(prev => ({ ...prev, loading: true, error: null }))
      
      const response = await fetch('/api/debug/database-schema')
      if (!response.ok) {
        throw new Error(`Failed to fetch database schema: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      setSchemaState({
        tables: data.tables || [],
        functions: data.functions || [],
        views: data.views || [],
        triggers: data.triggers || [],
        policies: data.policies || [],
        indexes: data.indexes || [],
        loading: false,
        lastRefresh: new Date().toLocaleString(),
        error: null
      })
      
      toast.success('Database schema refreshed')
    } catch (error) {
      console.error('Error fetching database schema:', error)
      setSchemaState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
      toast.error('Failed to fetch database schema')
    }
  }

  // Initial load
  useEffect(() => {
    fetchDatabaseSchema()
  }, [])

  // Auto-refresh setup with minimum interval enforcement
  useEffect(() => {
    if (!autoRefresh) return

    // Enforce minimum 30 second interval to reduce database load
    const safeInterval = Math.max(refreshInterval, 30)
    const interval = setInterval(fetchDatabaseSchema, safeInterval * 1000)
    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval])

  const tabs = [
    {
      id: 'tables',
      label: 'Tables',
      icon: Table,
      count: schemaState.tables.length,
      component: DatabaseTablesPanel
    },
    {
      id: 'functions',
      label: 'Functions',
      icon: FunctionIcon,
      count: schemaState.functions.length,
      component: DatabaseFunctionsPanel
    },
    {
      id: 'views',
      label: 'Views',
      icon: Eye,
      count: schemaState.views.length,
      component: DatabaseViewsPanel
    },
    {
      id: 'triggers',
      label: 'Triggers',
      icon: Zap,
      count: schemaState.triggers.length,
      component: DatabaseTriggersPanel
    },
    {
      id: 'policies',
      label: 'RLS Policies',
      icon: Shield,
      count: schemaState.policies.length,
      component: DatabasePoliciesPanel
    }
  ]

  const totalObjects = schemaState.tables.length + 
                      schemaState.functions.length + 
                      schemaState.views.length + 
                      schemaState.triggers.length + 
                      schemaState.policies.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Database Schema</h2>
          <p className="text-gray-600">
            Comprehensive database inspection with {totalObjects} objects
            {schemaState.lastRefresh && (
              <span className="ml-2 text-sm">
                • Last updated: {schemaState.lastRefresh}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDatabaseSchema}
            disabled={schemaState.loading}
          >
            {schemaState.loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between bg-white p-4 rounded-lg border">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search database objects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Auto-refresh:</span>
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'On' : 'Off'}
            </Button>
            {autoRefresh && (
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="text-sm border rounded px-2 py-1"
              >
                <option value={10}>10s</option>
                <option value={30}>30s</option>
                <option value={60}>1m</option>
                <option value={300}>5m</option>
              </select>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Badge variant="secondary">
            <Database className="h-3 w-3 mr-1" />
            {totalObjects} objects
          </Badge>
        </div>
      </div>

      {/* Error Display */}
      {schemaState.error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Error loading database schema:</p>
          <p className="text-red-600 text-sm mt-1">{schemaState.error}</p>
        </div>
      )}

      {/* Database Schema Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center space-x-2">
              <tab.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              <Badge variant="secondary" className="ml-1 text-xs">
                {tab.count}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-6">
            <tab.component
              data={schemaState[tab.id as keyof typeof schemaState] as any[]}
              searchQuery={searchQuery}
              loading={schemaState.loading}
              onRefresh={fetchDatabaseSchema}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
