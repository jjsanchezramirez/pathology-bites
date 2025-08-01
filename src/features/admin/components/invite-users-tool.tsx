// src/features/admin/components/invite-users-tool.tsx
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
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Separator } from '@/shared/components/ui/separator'
import { Badge } from '@/shared/components/ui/badge'
import { RefreshCw, Mail, Users, Plus, X, CheckCircle, AlertCircle, Clock } from 'lucide-react'

const inviteSchema = z.object({
  emails: z.string().min(1, 'At least one email is required'),
  role: z.enum(['user', 'creator', 'reviewer', 'admin'], {
    invalid_type_error: 'Please select a role'
  }),
  message: z.string().optional(),
  expiresInHours: z.number().min(1).max(168).optional()
})

type InviteFormData = z.infer<typeof inviteSchema>

interface InviteResult {
  invited: string[]
  alreadyExists: string[]
  failed: { email: string, error: string }[]
}

export function InviteUsersTool() {
  const [isLoading, setIsLoading] = useState(false)
  const [lastResult, setLastResult] = useState<InviteResult | null>(null)
  const [emailList, setEmailList] = useState<string[]>([])
  const [currentEmail, setCurrentEmail] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitted },
    setValue,
    watch,
    reset
  } = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      role: 'user',
      expiresInHours: 72
    }
  })

  const watchedEmails = watch('emails')

  const addEmail = () => {
    if (!currentEmail.trim()) return
    
    const email = currentEmail.trim().toLowerCase()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address')
      return
    }

    if (emailList.includes(email)) {
      toast.error('Email already added')
      return
    }

    const newEmailList = [...emailList, email]
    setEmailList(newEmailList)
    setValue('emails', newEmailList.join('\n'))
    setCurrentEmail('')
  }

  const removeEmail = (emailToRemove: string) => {
    const newEmailList = emailList.filter(email => email !== emailToRemove)
    setEmailList(newEmailList)
    setValue('emails', newEmailList.join('\n'))
  }

  const parseEmails = (emailText: string): string[] => {
    return emailText
      .split(/[\n,;]/)
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0)
  }

  const onSubmit = async (data: InviteFormData) => {
    try {
      setIsLoading(true)
      setLastResult(null)

      const emails = parseEmails(data.emails)
      
      if (emails.length === 0) {
        toast.error('Please enter at least one email address')
        return
      }

      const response = await fetch('/api/admin/invite-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emails,
          role: data.role,
          message: data.message,
          expiresInHours: data.expiresInHours || 72
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invitations')
      }

      setLastResult(result.results)
      
      const { summary } = result
      if (summary.invited > 0) {
        toast.success(`Successfully sent ${summary.invited} invitation${summary.invited !== 1 ? 's' : ''}`)
      }
      
      if (summary.alreadyExists > 0) {
        toast.warning(`${summary.alreadyExists} user${summary.alreadyExists !== 1 ? 's' : ''} already exist`)
      }
      
      if (summary.failed > 0) {
        toast.error(`Failed to invite ${summary.failed} user${summary.failed !== 1 ? 's' : ''}`)
      }

      // Clear form on success
      if (summary.invited > 0) {
        reset()
        setEmailList([])
        setCurrentEmail('')
      }

    } catch (error) {
      console.error('Invite users error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to send invitations')
    } finally {
      setIsLoading(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-blue-100 text-blue-800'
      case 'creator': return 'bg-yellow-100 text-yellow-800'
      case 'reviewer': return 'bg-purple-100 text-purple-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Invite Users
          </CardTitle>
          <CardDescription>
            Send invitation emails to new users with specific roles and permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Email Input Section */}
            <div className="space-y-4">
              <Label>Email Addresses</Label>
              
              {/* Single Email Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Enter email address"
                  value={currentEmail}
                  onChange={(e) => setCurrentEmail(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                  disabled={isLoading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={addEmail}
                  disabled={isLoading}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              {/* Email List Display */}
              {emailList.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm">Added Emails ({emailList.length})</Label>
                  <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
                    {emailList.map((email, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {email}
                        <button
                          type="button"
                          onClick={() => removeEmail(email)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Bulk Email Input */}
              <div className="space-y-2">
                <Label htmlFor="emails">Or paste multiple emails (separated by commas, semicolons, or new lines)</Label>
                <Textarea
                  id="emails"
                  placeholder="user1@example.com, user2@example.com&#10;user3@example.com"
                  rows={4}
                  disabled={isLoading}
                  {...register('emails')}
                  onChange={(e) => {
                    register('emails').onChange(e)
                    const emails = parseEmails(e.target.value)
                    setEmailList(emails)
                  }}
                />
                {isSubmitted && errors.emails && (
                  <p className="text-sm text-destructive">{errors.emails.message}</p>
                )}
              </div>
            </div>

            <Separator />

            {/* Role Selection */}
            <div className="space-y-2">
              <Label htmlFor="role">User Role</Label>
              <Select
                value={watch('role')}
                onValueChange={(value) => setValue('role', value as any)}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="creator">Creator</SelectItem>
                  <SelectItem value="reviewer">Reviewer</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              {isSubmitted && errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
            </div>

            {/* Expiration */}
            <div className="space-y-2">
              <Label htmlFor="expiresInHours">Invitation Expires In (Hours)</Label>
              <Input
                id="expiresInHours"
                type="number"
                min="1"
                max="168"
                placeholder="72"
                disabled={isLoading}
                {...register('expiresInHours', { valueAsNumber: true })}
              />
              <p className="text-sm text-muted-foreground">
                Default: 72 hours (3 days). Maximum: 168 hours (1 week)
              </p>
            </div>

            {/* Custom Message */}
            <div className="space-y-2">
              <Label htmlFor="message">Custom Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="Add a personal message to the invitation email..."
                rows={3}
                disabled={isLoading}
                {...register('message')}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || emailList.length === 0}
            >
              {isLoading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending Invitations...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Send {emailList.length} Invitation{emailList.length !== 1 ? 's' : ''}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Results Display */}
      {lastResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Invitation Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastResult.invited.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Successfully Invited ({lastResult.invited.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lastResult.invited.map((email, index) => (
                    <Badge key={index} className="bg-green-100 text-green-800">
                      {email}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {lastResult.alreadyExists.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-600" />
                  <span className="font-medium">Already Exists ({lastResult.alreadyExists.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lastResult.alreadyExists.map((email, index) => (
                    <Badge key={index} className="bg-yellow-100 text-yellow-800">
                      {email}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {lastResult.failed.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="font-medium">Failed ({lastResult.failed.length})</span>
                </div>
                <div className="space-y-1">
                  {lastResult.failed.map((failure, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <Badge className="bg-red-100 text-red-800">
                        {failure.email}
                      </Badge>
                      <span className="text-muted-foreground">{failure.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
