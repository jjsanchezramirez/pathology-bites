// src/features/auth/components/password-reset-tool.tsx
'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import { Badge } from '@/shared/components/ui/badge'
import { RefreshCw, Mail, Key, Shield, Clock, CheckCircle } from 'lucide-react'

const passwordResetSchema = z.object({
  email: z.string().email('Please enter a valid email address')
})

type PasswordResetFormData = z.infer<typeof passwordResetSchema>

interface PasswordResetToolProps {
  className?: string
}

export function PasswordResetTool({ className }: PasswordResetToolProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [resetType, setResetType] = useState<'reset' | 'magic_link'>('reset')
  const [lastResetTime, setLastResetTime] = useState<Date | null>(null)
  const [resetCount, setResetCount] = useState(0)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
    reset
  } = useForm<PasswordResetFormData>({
    resolver: zodResolver(passwordResetSchema)
  })

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

  const onSubmit = async (data: PasswordResetFormData) => {
    if (!canRequestReset()) {
      const remainingSeconds = Math.ceil(getRemainingCooldown() / 1000)
      toast.error(`Please wait ${remainingSeconds} seconds before requesting another reset`)
      return
    }

    try {
      setIsLoading(true)

      const response = await fetch('/api/user/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: data.email,
          type: resetType
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send reset email')
      }

      toast.success(result.message)
      setLastResetTime(new Date())
      setResetCount(prev => prev + 1)
      reset()

    } catch (error) {
      console.error('Password reset error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send reset email')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Password Reset Tool
          </CardTitle>
          <CardDescription>
            Reset your password or request a magic link to log in instantly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Reset Type Selection */}
          <div className="space-y-3">
            <Label>Reset Method</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={resetType === 'reset' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setResetType('reset')}
                className="flex-1"
              >
                <Key className="h-4 w-4 mr-2" />
                Password Reset
              </Button>
              <Button
                type="button"
                variant={resetType === 'magic_link' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setResetType('magic_link')}
                className="flex-1"
              >
                <Mail className="h-4 w-4 mr-2" />
                Magic Link
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {resetType === 'reset' 
                ? 'Send a link to create a new password'
                : 'Send a link to log in instantly without a password'
              }
            </p>
          </div>

          <Separator />

          {/* Email Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email address"
                disabled={isLoading}
                {...register('email')}
              />
              {isSubmitted && errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !canRequestReset()}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  {resetType === 'reset' ? 'Send Reset Link' : 'Send Magic Link'}
                </>
              )}
            </Button>

            {!canRequestReset() && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Wait {Math.ceil(getRemainingCooldown() / 1000)} seconds before requesting again
              </div>
            )}
          </form>

          {/* Status Information */}
          {resetCount > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium">Reset Status</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {resetCount} request{resetCount !== 1 ? 's' : ''} sent
                  </Badge>
                  {lastResetTime && (
                    <span className="text-sm text-muted-foreground">
                      Last sent: {lastResetTime.toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Security Information */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security Information
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Reset links expire after 1 hour</li>
              <li>• Only one reset request per minute</li>
              <li>• Links can only be used once</li>
              <li>• All reset attempts are logged for security</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
