// src/features/auth/components/forms/password-change-form.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { RefreshCw, Mail, Key } from 'lucide-react'
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status'

interface PasswordChangeFormProps {
  className?: string
  onSuccess?: () => void
}

export function PasswordChangeForm({ className, onSuccess }: PasswordChangeFormProps) {
  const [loading, setLoading] = useState(false)
  const [lastResetTime, setLastResetTime] = useState<Date | null>(null)
  const { user } = useAuthStatus()

  const canRequestReset = () => {
    if (!lastResetTime) return true
    const timeSinceLastReset = Date.now() - lastResetTime.getTime()
    const cooldownPeriod = 60000 // 1 minute
    return timeSinceLastReset > cooldownPeriod
  }

  const getRemainingCooldown = () => {
    if (!lastResetTime) return 0
    const timeSinceLastReset = Date.now() - lastResetTime.getTime()
    const cooldownPeriod = 60000 // 1 minute
    return Math.max(0, cooldownPeriod - timeSinceLastReset)
  }

  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast.error('No email address found for current user')
      return
    }

    if (!canRequestReset()) {
      const remainingSeconds = Math.ceil(getRemainingCooldown() / 1000)
      toast.error(`Please wait ${remainingSeconds} seconds before requesting another password reset`)
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/user/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: user.email,
          type: 'reset'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send password reset email')
      }

      toast.success('Password reset email sent! Check your email to change your password.')
      setLastResetTime(new Date())
      onSuccess?.()

    } catch (error) {
      console.error('Password reset error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send password reset email')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Change Password
        </CardTitle>
        <CardDescription>
          Change your password via a secure email link.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>We'll send a secure password reset link to <strong>{user?.email}</strong></p>
          </div>

          {lastResetTime && (
            <div className="text-sm text-muted-foreground">
              <p>Last reset email sent: {lastResetTime.toLocaleTimeString()}</p>
              {!canRequestReset() && (
                <p className="text-amber-600 dark:text-amber-400">
                  Please wait {Math.ceil(getRemainingCooldown() / 1000)} seconds before requesting another reset.
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handlePasswordReset}
            className="w-full"
            disabled={loading || !canRequestReset()}
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Sending Reset Email...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Password Reset Email
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
