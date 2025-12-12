// src/features/dashboard/components/security-notice.tsx
'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { userSettingsService } from '@/shared/services/user-settings'

interface SecurityNoticeProps {
  onDismiss: () => void
}

export function SecurityNotice({ onDismiss }: SecurityNoticeProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDismiss = async () => {
    setIsLoading(true)
    try {
      await userSettingsService.markSecurityNoticeDismissed()
      onDismiss()
    } catch (error) {
      console.error('Error dismissing security notice:', error)
      // Still dismiss the notice locally even if the API call fails
      onDismiss()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="relative bg-card border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              👌 Security Update Complete
            </h3>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                We experienced brief downtime today (December 9, 2025) while addressing a critical security vulnerability. All systems are now secure and fully operational.
              </p>

              <p>
                <strong>What we did:</strong>
              </p>

              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>
                  Upgraded to the latest secure version of Next.js (15.4.8)
                </li>
                <li>
                  Deployed security fixes to production within minutes
                </li>
                <li>
                  Verified all systems are functioning normally
                </li>
              </ul>

              <p>
                Your data is safe. Thank you for your patience and understanding.
              </p>
            </div>
          </div>

          {/* Close Button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-gray-100 flex-shrink-0"
            onClick={handleDismiss}
            disabled={isLoading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

