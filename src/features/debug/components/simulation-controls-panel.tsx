// src/features/debug/components/simulation-controls-panel.tsx
/**
 * Simulation Controls Panel - Simulate adverse conditions and testing scenarios
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Switch } from '@/shared/components/ui/switch'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Badge } from '@/shared/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Zap, Wifi, Globe, Clock, AlertTriangle } from 'lucide-react'
import { DebugPanelState, DebugAccessLevel } from '@/shared/types/debug'
import { toast } from '@/shared/utils/toast'

interface SimulationControlsPanelProps {
  debugState: DebugPanelState
  executeAction: (action: string, payload?: any) => Promise<any>
  accessLevel: DebugAccessLevel
}

export function SimulationControlsPanel({ 
  debugState, 
  executeAction, 
  accessLevel 
}: SimulationControlsPanelProps) {
  const [customLatency, setCustomLatency] = useState(1000)
  const [customErrorCode, setCustomErrorCode] = useState(500)
  const [selectedLocale, setSelectedLocale] = useState('en-US')
  const [selectedTimezone, setSelectedTimezone] = useState('UTC')

  // Mock simulation data
  const errorSimulations = [
    { id: 'server_error', name: '500 Server Error', enabled: false, probability: 10 },
    { id: 'auth_error', name: '401 Unauthorized', enabled: false, probability: 5 },
    { id: 'forbidden', name: '403 Forbidden', enabled: false, probability: 5 },
    { id: 'rate_limit', name: '429 Rate Limited', enabled: false, probability: 15 }
  ]

  const latencySimulations = [
    { id: 'slow_network', name: 'Slow Network (2s)', enabled: false, delay: 2000 },
    { id: 'very_slow', name: 'Very Slow (5s)', enabled: false, delay: 5000 },
    { id: 'timeout_risk', name: 'Timeout Risk (10s)', enabled: false, delay: 10000 }
  ]

  const localeOptions = [
    { code: 'en-US', name: 'English (US)', timezone: 'America/New_York' },
    { code: 'en-GB', name: 'English (UK)', timezone: 'Europe/London' },
    { code: 'es-ES', name: 'Spanish (Spain)', timezone: 'Europe/Madrid' },
    { code: 'fr-FR', name: 'French (France)', timezone: 'Europe/Paris' },
    { code: 'de-DE', name: 'German (Germany)', timezone: 'Europe/Berlin' },
    { code: 'ja-JP', name: 'Japanese (Japan)', timezone: 'Asia/Tokyo' }
  ]

  const toggleErrorSimulation = async (id: string, enabled: boolean) => {
    try {
      await executeAction('TOGGLE_ERROR_SIMULATION', { id, enabled })
      toast.success(`Error simulation ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      toast.error('Failed to toggle error simulation')
    }
  }

  const toggleLatencySimulation = async (id: string, enabled: boolean) => {
    try {
      await executeAction('TOGGLE_LATENCY_SIMULATION', { id, enabled })
      toast.success(`Latency simulation ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      toast.error('Failed to toggle latency simulation')
    }
  }

  const updateLocaleSimulation = async () => {
    try {
      await executeAction('UPDATE_LOCALE_SIMULATION', {
        locale: selectedLocale,
        timezone: selectedTimezone,
        enabled: true
      })
      toast.success('Locale simulation updated')
    } catch (error) {
      toast.error('Failed to update locale simulation')
    }
  }

  if (accessLevel === 'none') {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Simulation controls require elevated access permissions.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="errors" className="space-y-4">
        <TabsList>
          <TabsTrigger value="errors">Error Simulation</TabsTrigger>
          <TabsTrigger value="latency">Network Latency</TabsTrigger>
          <TabsTrigger value="locale">Locale & Timezone</TabsTrigger>
        </TabsList>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5" />
                <span>Error Response Simulation</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {errorSimulations.map(simulation => (
                <div key={simulation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{simulation.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Probability: {simulation.probability}%
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={simulation.enabled ? 'default' : 'secondary'}>
                      {simulation.enabled ? 'Active' : 'Inactive'}
                    </Badge>
                    <Switch
                      checked={simulation.enabled}
                      onCheckedChange={(enabled) => toggleErrorSimulation(simulation.id, enabled)}
                    />
                  </div>
                </div>
              ))}

              <div className="border-t pt-4">
                <Label>Custom Error Code</Label>
                <div className="flex space-x-2 mt-2">
                  <Input
                    type="number"
                    value={customErrorCode}
                    onChange={(e) => setCustomErrorCode(Number(e.target.value))}
                    className="w-32"
                  />
                  <Button onClick={() => toggleErrorSimulation('custom', true)}>
                    Enable Custom Error
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="latency">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wifi className="h-5 w-5" />
                <span>Network Latency Simulation</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {latencySimulations.map(simulation => (
                <div key={simulation.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{simulation.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Delay: {simulation.delay}ms
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={simulation.enabled ? 'default' : 'secondary'}>
                      {simulation.enabled ? 'Active' : 'Inactive'}
                    </Badge>
                    <Switch
                      checked={simulation.enabled}
                      onCheckedChange={(enabled) => toggleLatencySimulation(simulation.id, enabled)}
                    />
                  </div>
                </div>
              ))}

              <div className="border-t pt-4">
                <Label>Custom Latency (ms)</Label>
                <div className="flex space-x-2 mt-2">
                  <Input
                    type="number"
                    value={customLatency}
                    onChange={(e) => setCustomLatency(Number(e.target.value))}
                    className="w-32"
                  />
                  <Button onClick={() => toggleLatencySimulation('custom', true)}>
                    Enable Custom Latency
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="locale">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="h-5 w-5" />
                <span>Locale & Timezone Simulation</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Locale</Label>
                  <select
                    value={selectedLocale}
                    onChange={(e) => setSelectedLocale(e.target.value)}
                    className="w-full mt-2 p-2 border rounded-md"
                  >
                    {localeOptions.map(option => (
                      <option key={option.code} value={option.code}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Input
                    value={selectedTimezone}
                    onChange={(e) => setSelectedTimezone(e.target.value)}
                    className="mt-2"
                  />
                </div>
              </div>

              <Button onClick={updateLocaleSimulation} className="w-full">
                Apply Locale Settings
              </Button>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Current Simulation Status</h4>
                <div className="space-y-1 text-sm">
                  <div>Locale: {debugState.localeSimulation?.locale || 'en-US'}</div>
                  <div>Timezone: {debugState.localeSimulation?.timezone || 'UTC'}</div>
                  <div>Status: {debugState.localeSimulation?.enabled ? 'Active' : 'Inactive'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Active Simulations Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Active Simulations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {debugState.simulationsActive?.length > 0 ? (
              debugState.simulationsActive.map(sim => (
                <Badge key={sim} variant="default">{sim}</Badge>
              ))
            ) : (
              <p className="text-muted-foreground">No active simulations</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
