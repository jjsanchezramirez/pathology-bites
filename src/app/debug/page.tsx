// src/app/debug/page.tsx
/**
 * Unified Debug Interface - Single page with tabs for all debugging functionality
 * Simplified interface with API tests, database tools, and utilities
 */

'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Badge } from '@/shared/components/ui/badge'
import {
  Bug,
  TestTube,
  Database,
  Settings,
  Server,
  Bot,
  Palette
} from 'lucide-react'

// Import tab components
import { ApiTestsTab } from '@/features/debug/components/api-tests-tab'
import { DatabaseTab } from '@/features/debug/components/database-tab'
import { ToolsTab } from '@/features/debug/components/tools-tab'
import { SystemTab } from '@/features/debug/components/system-tab'
import { AiModelsTab } from '@/features/debug/components/ai-models-tab'
import { UiComponentsTab } from '@/features/debug/components/ui-components-tab'

function UnifiedDebugInterface() {
  const [activeTab, setActiveTab] = useState('api-tests')

  // Completely disable in production
  if (process.env.NODE_ENV === 'production') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <p className="text-gray-600">Page not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Bug className="h-8 w-8 text-red-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Debug Tools</h1>
                <p className="text-gray-600">Development and debugging utilities</p>
              </div>
            </div>
            <Badge
              variant={(process.env.NODE_ENV as string) === 'production' ? 'destructive' : 'default'}
              className="text-sm"
            >
              {process.env.NODE_ENV?.toUpperCase() || 'DEVELOPMENT'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="api-tests" className="flex items-center space-x-2">
              <TestTube className="h-4 w-4" />
              <span className="hidden sm:inline">API Tests</span>
            </TabsTrigger>
            <TabsTrigger value="database" className="flex items-center space-x-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Database</span>
            </TabsTrigger>
            <TabsTrigger value="ai-models" className="flex items-center space-x-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">AI Models</span>
            </TabsTrigger>
            <TabsTrigger value="ui-components" className="flex items-center space-x-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">UI Components</span>
            </TabsTrigger>
            <TabsTrigger value="tools" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Tools</span>
            </TabsTrigger>
            <TabsTrigger value="system" className="flex items-center space-x-2">
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline">System</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api-tests">
            <ApiTestsTab />
          </TabsContent>

          <TabsContent value="database">
            <DatabaseTab />
          </TabsContent>

          <TabsContent value="ai-models">
            <AiModelsTab />
          </TabsContent>

          <TabsContent value="ui-components">
            <UiComponentsTab />
          </TabsContent>

          <TabsContent value="tools">
            <ToolsTab />
          </TabsContent>

          <TabsContent value="system">
            <SystemTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default UnifiedDebugInterface