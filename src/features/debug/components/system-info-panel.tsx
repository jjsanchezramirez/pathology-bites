// src/features/debug/components/system-info-panel.tsx
/**
 * System Info Panel - System information, logs, and business events
 */

'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { 
  Activity, 
  RefreshCw, 
  Download, 
  Filter,
  Info,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Clock,
  GitBranch,
  Server,
  Zap
} from 'lucide-react'
import { DebugPanelState, DebugAccessLevel, LogEntry, BusinessEvent } from '@/shared/types/debug'
import { toast } from '@/shared/utils/toast'

interface SystemInfoPanelProps {
  debugState: DebugPanelState
  executeAction: (action: string, payload?: any) => Promise<any>
  accessLevel: DebugAccessLevel
}

export function SystemInfoPanel({ 
  debugState, 
  executeAction, 
  accessLevel 
}: SystemInfoPanelProps) {
  const [logFilter, setLogFilter] = useState('')
  const [logLevel, setLogLevel] = useState('all')
  const [eventFilter, setEventFilter] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Mock log entries
  const mockLogs: LogEntry[] = [
    {
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'User authentication successful',
      category: 'auth',
      userId: 'user_123',
      requestId: 'req_456'
    },
    {
      timestamp: new Date(Date.now() - 60000).toISOString(),
      level: 'warn',
      message: 'Slow database query detected',
      category: 'database',
      metadata: { queryTime: 2500, query: 'SELECT * FROM questions...' }
    },
    {
      timestamp: new Date(Date.now() - 120000).toISOString(),
      level: 'error',
      message: 'Failed to send notification email',
      category: 'email',
      metadata: { error: 'SMTP timeout', recipient: 'user@example.com' }
    }
  ]

  // Mock business events
  const mockEvents: BusinessEvent[] = [
    {
      id: 'evt_1',
      timestamp: new Date().toISOString(),
      type: 'question_created',
      description: 'New question submitted for review',
      userId: 'user_123',
      metadata: { questionId: 'q_456', category: 'pathology' },
      severity: 'low'
    },
    {
      id: 'evt_2',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      type: 'user_registered',
      description: 'New user registration completed',
      userId: 'user_789',
      metadata: { email: 'newuser@example.com', role: 'user' },
      severity: 'low'
    }
  ]

  const logs = debugState.logs.length > 0 ? debugState.logs : mockLogs
  const events = debugState.businessEvents.length > 0 ? debugState.businessEvents : mockEvents

  const filteredLogs = logs.filter(log => {
    const matchesFilter = log.message.toLowerCase().includes(logFilter.toLowerCase()) ||
                         log.category.toLowerCase().includes(logFilter.toLowerCase())
    const matchesLevel = logLevel === 'all' || log.level === logLevel
    return matchesFilter && matchesLevel
  })

  const filteredEvents = events.filter(event => {
    return event.description.toLowerCase().includes(eventFilter.toLowerCase()) ||
           event.type.toLowerCase().includes(eventFilter.toLowerCase())
  })

  const refreshLogs = async () => {
    try {
      await executeAction('REFRESH_LOGS')
      toast.success('Logs refreshed')
    } catch (error) {
      toast.error('Failed to refresh logs')
    }
  }

  const refreshEvents = async () => {
    try {
      await executeAction('REFRESH_EVENTS')
      toast.success('Events refreshed')
    } catch (error) {
      toast.error('Failed to refresh events')
    }
  }

  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `debug-logs-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportEvents = () => {
    const dataStr = JSON.stringify(filteredEvents, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `business-events-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      case 'warn': return <AlertTriangle className="h-4 w-4 text-orange-500" />
      case 'info': return <Info className="h-4 w-4 text-blue-500" />
      case 'debug': return <CheckCircle className="h-4 w-4 text-gray-500" />
      default: return <Info className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-50'
      case 'medium': return 'text-orange-600 bg-orange-50'
      case 'low': return 'text-green-600 bg-green-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      refreshLogs()
      refreshEvents()
    }, 10000) // Refresh every 10 seconds

    return () => clearInterval(interval)
  }, [autoRefresh])

  return (
    <div className="space-y-6">
      {/* System Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Server className="h-4 w-4" />
              <span className="text-sm font-medium">Version</span>
            </div>
            <div className="text-lg font-bold">{debugState.systemInfo.version}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <GitBranch className="h-4 w-4" />
              <span className="text-sm font-medium">Git Commit</span>
            </div>
            <div className="text-sm font-mono">
              {debugState.systemInfo.gitCommit.substring(0, 8)}...
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Clock className="h-4 w-4" />
              <span className="text-sm font-medium">Uptime</span>
            </div>
            <div className="text-lg font-bold">
              {Math.floor(debugState.systemInfo.uptime / 3600)}h {Math.floor((debugState.systemInfo.uptime % 3600) / 60)}m
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Zap className="h-4 w-4" />
              <span className="text-sm font-medium">Environment</span>
            </div>
            <Badge variant={debugState.systemInfo.environment === 'development' ? 'default' : 'secondary'}>
              {debugState.systemInfo.environment.toUpperCase()}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Logs and Events */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Application Logs</TabsTrigger>
          <TabsTrigger value="events">Business Events</TabsTrigger>
          <TabsTrigger value="system">System Details</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Application Logs</span>
                  <Badge variant="outline">{filteredLogs.length}</Badge>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={exportLogs}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={refreshLogs}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
              <div className="flex space-x-2">
                <Input
                  placeholder="Filter logs..."
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value)}
                  className="flex-1"
                />
                <Select value={logLevel} onValueChange={setLogLevel}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="warn">Warning</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {filteredLogs.map((log, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          {getLogIcon(log.level)}
                          <Badge variant="outline">{log.category}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <Badge variant={log.level === 'error' ? 'destructive' : 'outline'}>
                          {log.level.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{log.message}</p>
                      {log.metadata && (
                        <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      )}
                      {(log.userId || log.requestId) && (
                        <div className="flex space-x-4 text-xs text-muted-foreground mt-2">
                          {log.userId && <span>User: {log.userId}</span>}
                          {log.requestId && <span>Request: {log.requestId}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="h-5 w-5" />
                  <span>Business Events</span>
                  <Badge variant="outline">{filteredEvents.length}</Badge>
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={exportEvents}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </Button>
                  <Button variant="outline" size="sm" onClick={refreshEvents}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
              <Input
                placeholder="Filter events..."
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
              />
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-96">
                <div className="space-y-2">
                  {filteredEvents.map((event) => (
                    <div key={event.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{event.type}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <Badge className={getSeverityColor(event.severity)}>
                          {event.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{event.description}</p>
                      <pre className="text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                        {JSON.stringify(event.metadata, null, 2)}
                      </pre>
                      {event.userId && (
                        <div className="text-xs text-muted-foreground mt-2">
                          User: {event.userId}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Server className="h-5 w-5" />
                <span>System Details</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Application</h4>
                    <div className="space-y-1 text-sm">
                      <div>Version: {debugState.systemInfo.version}</div>
                      <div>Build Time: {new Date(debugState.systemInfo.buildTime).toLocaleString()}</div>
                      <div>Environment: {debugState.systemInfo.environment}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Git Information</h4>
                    <div className="space-y-1 text-sm">
                      <div>Commit: {debugState.systemInfo.gitCommit}</div>
                      <div>Branch: {debugState.systemInfo.gitBranch}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Runtime</h4>
                    <div className="space-y-1 text-sm">
                      <div>Node.js: {debugState.systemInfo.nodeVersion}</div>
                      <div>Next.js: {debugState.systemInfo.nextVersion}</div>
                      <div>Uptime: {Math.floor(debugState.systemInfo.uptime / 3600)}h {Math.floor((debugState.systemInfo.uptime % 3600) / 60)}m</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
