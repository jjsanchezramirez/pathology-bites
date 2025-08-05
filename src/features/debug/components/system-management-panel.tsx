// src/features/debug/components/system-management-panel.tsx
/**
 * System Management Panel - Global toggles and environment variable management
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Switch } from '@/shared/components/ui/switch'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Textarea } from '@/shared/components/ui/textarea'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { 
  Settings, 
  AlertTriangle, 
  Power, 
  Clock, 
  Shield,
  Globe,
  Database,
  Key,
  Eye,
  EyeOff,
  Save,
  RotateCcw
} from 'lucide-react'
import { DebugPanelState, DebugAccessLevel, SystemToggle, EnvVariable } from '@/shared/types/debug'
import { toast } from '@/shared/utils/toast'

interface SystemManagementPanelProps {
  debugState: DebugPanelState
  executeAction: (action: string, payload?: any) => Promise<any>
  accessLevel: DebugAccessLevel
}

export function SystemManagementPanel({ 
  debugState, 
  executeAction, 
  accessLevel 
}: SystemManagementPanelProps) {
  const [maintenanceMessage, setMaintenanceMessage] = useState('')
  const [comingSoonDate, setComingSoonDate] = useState('')
  const [envUpdates, setEnvUpdates] = useState<Record<string, string>>({})
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({})

  // Mock system toggles - in real implementation, these would come from debugState
  const systemToggles: SystemToggle[] = [
    {
      id: 'maintenance_mode',
      name: 'Maintenance Mode',
      description: 'Redirect all public traffic to maintenance page',
      enabled: process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true',
      scope: 'global',
      requiresRestart: false,
      dangerLevel: 'high'
    },
    {
      id: 'coming_soon_mode',
      name: 'Coming Soon Mode',
      description: 'Show coming soon page to non-authenticated users',
      enabled: process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true',
      scope: 'global',
      requiresRestart: false,
      dangerLevel: 'medium'
    }
  ]

  // Mock environment variables - in real implementation, these would come from debugState
  const envVariables: EnvVariable[] = [
    {
      key: 'NEXT_PUBLIC_SITE_URL',
      value: process.env.NEXT_PUBLIC_SITE_URL || '',
      type: 'string',
      sensitive: false,
      description: 'Base URL for the application',
      scope: 'global',
      category: 'system'
    },
    {
      key: 'NEXT_PUBLIC_SUPABASE_URL',
      value: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      type: 'string',
      sensitive: true,
      description: 'Supabase project URL',
      scope: 'global',
      category: 'database'
    },
    {
      key: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
      value: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
      type: 'string',
      sensitive: true,
      description: 'Google OAuth client ID',
      scope: 'global',
      category: 'auth'
    },
    {
      key: 'NEXT_PUBLIC_ENABLE_NOTIFICATIONS',
      value: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS || 'true',
      type: 'boolean',
      sensitive: false,
      description: 'Enable push notifications',
      scope: 'session',
      category: 'features'
    }
  ]

  const handleToggleChange = async (toggleId: string, enabled: boolean) => {
    try {
      await executeAction('TOGGLE_SYSTEM_SETTING', { id: toggleId, enabled })
      // Removed toast notification for system setting changes - UI feedback is immediate
    } catch (error) {
      toast.error('Failed to update system setting')
    }
  }

  const handleEnvUpdate = (key: string, value: string) => {
    setEnvUpdates(prev => ({ ...prev, [key]: value }))
  }

  const saveEnvChanges = async () => {
    try {
      for (const [key, value] of Object.entries(envUpdates)) {
        await executeAction('UPDATE_ENV_VARIABLE', { key, value, scope: 'session' })
      }
      setEnvUpdates({})
      toast.success('Environment variables updated')
    } catch (error) {
      toast.error('Failed to update environment variables')
    }
  }

  const resetEnvChanges = () => {
    setEnvUpdates({})
    toast.info('Changes reset')
  }

  const toggleSensitiveVisibility = (key: string) => {
    setShowSensitive(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const getDangerColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200'
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'low': return 'text-green-600 bg-green-50 border-green-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'auth': return Shield
      case 'database': return Database
      case 'features': return Settings
      case 'system': return Globe
      case 'external': return Key
      default: return Settings
    }
  }

  if (accessLevel !== 'admin') {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          System management features require admin access level.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="toggles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="toggles">System Toggles</TabsTrigger>
          <TabsTrigger value="environment">Environment Variables</TabsTrigger>
        </TabsList>

        <TabsContent value="toggles" className="space-y-4">
          {/* System Toggles */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Power className="h-5 w-5" />
                <span>System Toggles</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {systemToggles.map((toggle) => (
                <div key={toggle.id} className={`p-4 rounded-lg border ${getDangerColor(toggle.dangerLevel)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-medium">{toggle.name}</h3>
                        <Badge variant={toggle.scope === 'global' ? 'default' : 'secondary'}>
                          {toggle.scope}
                        </Badge>
                        <Badge variant={toggle.dangerLevel === 'high' ? 'destructive' : 'outline'}>
                          {toggle.dangerLevel} risk
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{toggle.description}</p>
                      {toggle.requiresRestart && (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ Requires application restart
                        </p>
                      )}
                    </div>
                    <Switch
                      checked={toggle.enabled}
                      onCheckedChange={(enabled) => handleToggleChange(toggle.id, enabled)}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Maintenance Mode Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Maintenance Mode Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="maintenance-message">Maintenance Message</Label>
                <Textarea
                  id="maintenance-message"
                  placeholder="We're currently performing scheduled maintenance..."
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                />
              </div>
              <Button onClick={() => executeAction('UPDATE_MAINTENANCE_CONFIG', { message: maintenanceMessage })}>
                Update Maintenance Message
              </Button>
            </CardContent>
          </Card>

          {/* Coming Soon Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Coming Soon Configuration</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="launch-date">Launch Date</Label>
                <Input
                  id="launch-date"
                  type="datetime-local"
                  value={comingSoonDate}
                  onChange={(e) => setComingSoonDate(e.target.value)}
                />
              </div>
              <Button onClick={() => executeAction('UPDATE_COMING_SOON_CONFIG', { launchDate: comingSoonDate })}>
                Update Launch Date
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="environment" className="space-y-4">
          {/* Environment Variables */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Key className="h-5 w-5" />
                  <span>Environment Variables</span>
                </CardTitle>
                <div className="flex space-x-2">
                  {Object.keys(envUpdates).length > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={resetEnvChanges}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                      <Button size="sm" onClick={saveEnvChanges}>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {envVariables.map((envVar) => {
                const CategoryIcon = getCategoryIcon(envVar.category)
                const currentValue = envUpdates[envVar.key] ?? envVar.value
                const hasChanges = envUpdates[envVar.key] !== undefined
                
                return (
                  <div key={envVar.key} className="p-4 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <CategoryIcon className="h-4 w-4" />
                        <span className="font-mono text-sm font-medium">{envVar.key}</span>
                        <Badge variant="outline">{envVar.category}</Badge>
                        <Badge variant={envVar.scope === 'global' ? 'default' : 'secondary'}>
                          {envVar.scope}
                        </Badge>
                        {hasChanges && <Badge variant="destructive">Modified</Badge>}
                      </div>
                      {envVar.sensitive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSensitiveVisibility(envVar.key)}
                        >
                          {showSensitive[envVar.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                    
                    {envVar.description && (
                      <p className="text-xs text-muted-foreground">{envVar.description}</p>
                    )}
                    
                    <div className="flex space-x-2">
                      <Input
                        type={envVar.sensitive && !showSensitive[envVar.key] ? 'password' : 'text'}
                        value={currentValue}
                        onChange={(e) => handleEnvUpdate(envVar.key, e.target.value)}
                        className={hasChanges ? 'border-orange-300' : ''}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
