// src/features/debug/components/state-manager-panel.tsx
/**
 * State Manager Panel - Real-time state inspection and manipulation
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Textarea } from '@/shared/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { 
  Database, 
  RefreshCw, 
  Save, 
  Copy,
  Edit,
  Trash2,
  Plus,
  Eye,
  AlertTriangle
} from 'lucide-react'
import { DebugPanelState, DebugAccessLevel, StateSnapshot, StateUpdate } from '@/shared/types/debug'
import { toast } from '@/shared/utils/toast'

interface StateManagerPanelProps {
  debugState: DebugPanelState
  executeAction: (action: string, payload?: any) => Promise<any>
  accessLevel: DebugAccessLevel
}

export function StateManagerPanel({ 
  debugState, 
  executeAction, 
  accessLevel 
}: StateManagerPanelProps) {
  const [selectedPath, setSelectedPath] = useState<string>('')
  const [editValue, setEditValue] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [stateFilter, setStateFilter] = useState<string>('')

  // Mock state data - in real implementation, this would come from debugState
  const mockStateSnapshot: StateSnapshot = {
    timestamp: new Date().toISOString(),
    clientState: {
      user: {
        id: 'user_123',
        email: 'test@example.com',
        role: 'admin',
        preferences: {
          theme: 'dark',
          language: 'en'
        }
      },
      ui: {
        sidebarCollapsed: false,
        activeTab: 'dashboard',
        notifications: [
          { id: 1, message: 'Welcome!', type: 'info' },
          { id: 2, message: 'Update available', type: 'warning' }
        ]
      },
      quiz: {
        currentSession: null,
        history: [],
        settings: {
          autoSubmit: true,
          showExplanations: true
        }
      }
    },
    serverState: {
      session: {
        userId: 'user_123',
        role: 'admin',
        loginTime: '2024-01-15T10:30:00Z',
        lastActivity: '2024-01-15T14:45:00Z'
      },
      cache: {
        questions: 1250,
        users: 45,
        categories: 12
      }
    },
    sessionData: {
      'pathology-bites-session': 'eyJhbGciOiJIUzI1NiJ9...',
      'debug-mode': 'true',
      'last-visit': '2024-01-15'
    },
    cookies: {
      'sb-htsnkuudinrcgfqlqmpi-auth-token': 'eyJhbGciOiJIUzI1NiJ9...',
      'theme': 'dark',
      'language': 'en'
    }
  }

  const stateSnapshot = debugState.stateSnapshot || mockStateSnapshot

  const refreshState = async () => {
    try {
      await executeAction('REFRESH_STATE')
      toast.success('State refreshed')
    } catch (error) {
      toast.error('Failed to refresh state')
    }
  }

  const updateState = async (path: string, value: any, type: 'client' | 'server' | 'session') => {
    try {
      await executeAction('UPDATE_STATE', { path, value, type })
      toast.success('State updated')
      setIsEditing(false)
      setSelectedPath('')
      setEditValue('')
    } catch (error) {
      toast.error('Failed to update state')
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied to clipboard')
  }

  const startEditing = (path: string, currentValue: any) => {
    setSelectedPath(path)
    setEditValue(JSON.stringify(currentValue, null, 2))
    setIsEditing(true)
  }

  const saveEdit = () => {
    try {
      const parsedValue = JSON.parse(editValue)
      const [type, ...pathParts] = selectedPath.split('.')
      const path = pathParts.join('.')
      updateState(path, parsedValue, type as 'client' | 'server' | 'session')
    } catch (error) {
      toast.error('Invalid JSON format')
    }
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setSelectedPath('')
    setEditValue('')
  }

  const renderStateTree = (obj: any, prefix: string = '', level: number = 0) => {
    if (level > 3) return null // Prevent infinite recursion

    return Object.entries(obj).map(([key, value]) => {
      const fullPath = prefix ? `${prefix}.${key}` : key
      const isObject = typeof value === 'object' && value !== null && !Array.isArray(value)
      const isArray = Array.isArray(value)
      
      if (stateFilter && !fullPath.toLowerCase().includes(stateFilter.toLowerCase())) {
        return null
      }

      return (
        <div key={fullPath} className={`ml-${level * 4}`}>
          <div className="flex items-center justify-between py-1 px-2 hover:bg-gray-50 rounded">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm font-medium">{key}</span>
              {isArray && <Badge variant="outline">Array[{value.length}]</Badge>}
              {isObject && <Badge variant="outline">Object</Badge>}
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(JSON.stringify(value, null, 2))}
              >
                <Copy className="h-3 w-3" />
              </Button>
              {accessLevel !== 'read' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEditing(fullPath, value)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          
          {!isObject && !isArray && (
            <div className="ml-4 text-sm text-muted-foreground font-mono">
              {typeof value === 'string' ? `"${value}"` : String(value)}
            </div>
          )}
          
          {(isObject || isArray) && level < 2 && (
            <div className="ml-4">
              {renderStateTree(value, fullPath, level + 1)}
            </div>
          )}
        </div>
      )
    }).filter(Boolean)
  }

  if (accessLevel === 'none') {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          State management features require elevated access permissions.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* State Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Application State</span>
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Input
                placeholder="Filter state keys..."
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="w-48"
              />
              <Button variant="outline" size="sm" onClick={refreshState}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(stateSnapshot.timestamp).toLocaleString()}
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="client" className="space-y-4">
            <TabsList>
              <TabsTrigger value="client">Client State</TabsTrigger>
              <TabsTrigger value="server">Server State</TabsTrigger>
              <TabsTrigger value="session">Session Data</TabsTrigger>
              <TabsTrigger value="cookies">Cookies</TabsTrigger>
            </TabsList>

            <TabsContent value="client">
              <ScrollArea className="h-96 border rounded-lg p-4">
                {renderStateTree(stateSnapshot.clientState, 'client')}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="server">
              <ScrollArea className="h-96 border rounded-lg p-4">
                {renderStateTree(stateSnapshot.serverState, 'server')}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="session">
              <ScrollArea className="h-96 border rounded-lg p-4">
                {renderStateTree(stateSnapshot.sessionData, 'session')}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="cookies">
              <ScrollArea className="h-96 border rounded-lg p-4">
                {renderStateTree(stateSnapshot.cookies, 'cookies')}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* State Editor */}
      {isEditing && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Edit className="h-5 w-5" />
              <span>Edit State Value</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Editing: <span className="font-mono">{selectedPath}</span>
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Value (JSON)</Label>
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="mt-2 font-mono text-sm"
                rows={10}
                placeholder="Enter valid JSON..."
              />
            </div>
            <div className="flex space-x-2">
              <Button onClick={saveEdit}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Button variant="outline" onClick={cancelEdit}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* State Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {Object.keys(stateSnapshot.clientState).length}
            </div>
            <p className="text-sm text-muted-foreground">Client State Keys</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {Object.keys(stateSnapshot.serverState).length}
            </div>
            <p className="text-sm text-muted-foreground">Server State Keys</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {Object.keys(stateSnapshot.sessionData).length}
            </div>
            <p className="text-sm text-muted-foreground">Session Items</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">
              {Object.keys(stateSnapshot.cookies).length}
            </div>
            <p className="text-sm text-muted-foreground">Cookies</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
