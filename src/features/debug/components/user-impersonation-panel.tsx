// src/features/debug/components/user-impersonation-panel.tsx
/**
 * User Impersonation Panel - Secure user impersonation for debugging
 */

'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Badge } from '@/shared/components/ui/badge'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'
import { Users, Search, LogIn, LogOut, AlertTriangle } from 'lucide-react'
import { DebugPanelState, DebugAccessLevel } from '@/shared/types/debug'
import { toast } from '@/shared/utils/toast'

interface UserImpersonationPanelProps {
  debugState: DebugPanelState
  executeAction: (action: string, payload?: any) => Promise<any>
  accessLevel: DebugAccessLevel
}

export function UserImpersonationPanel({ 
  debugState, 
  executeAction, 
  accessLevel 
}: UserImpersonationPanelProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [impersonationReason, setImpersonationReason] = useState('')

  // Mock user data
  const mockUsers = [
    { id: 'user_1', email: 'admin@example.com', role: 'admin', status: 'active' },
    { id: 'user_2', email: 'creator@example.com', role: 'creator', status: 'active' },
    { id: 'user_3', email: 'reviewer@example.com', role: 'reviewer', status: 'active' },
    { id: 'user_4', email: 'student@example.com', role: 'user', status: 'active' }
  ]

  const startImpersonation = async (userId: string) => {
    try {
      await executeAction('START_IMPERSONATION', { userId, reason: impersonationReason })
      toast.success('Impersonation started')
    } catch (error) {
      toast.error('Failed to start impersonation')
    }
  }

  const stopImpersonation = async () => {
    try {
      await executeAction('STOP_IMPERSONATION')
      toast.success('Impersonation stopped')
    } catch (error) {
      toast.error('Failed to stop impersonation')
    }
  }

  if (accessLevel === 'none' || accessLevel === 'read') {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          User impersonation requires write or admin access level.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>User Impersonation</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Search users by email or ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline">
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {mockUsers
              .filter(user => 
                user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                user.id.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map(user => (
                <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <div className="font-medium">{user.email}</div>
                    <div className="text-sm text-muted-foreground">
                      ID: {user.id} | Role: {user.role}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                      {user.status}
                    </Badge>
                    <Button
                      size="sm"
                      onClick={() => startImpersonation(user.id)}
                    >
                      <LogIn className="h-4 w-4 mr-2" />
                      Impersonate
                    </Button>
                  </div>
                </div>
              ))}
          </div>

          <div>
            <Input
              placeholder="Reason for impersonation (optional)"
              value={impersonationReason}
              onChange={(e) => setImpersonationReason(e.target.value)}
            />
          </div>

          {debugState.impersonationSession && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Currently impersonating user: {debugState.impersonationSession.targetUserEmail}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-2"
                  onClick={stopImpersonation}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Stop Impersonation
                </Button>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
