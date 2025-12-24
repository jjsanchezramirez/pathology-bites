'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Button } from '@/shared/components/ui/button'
import { AlertTriangle, Trash2 } from 'lucide-react'

interface DangerZoneProps {
  onDeleteAccountClick: () => void
}

export function DangerZone({
  onDeleteAccountClick
}: DangerZoneProps) {
  return (
    <Card className="border-red-200 dark:border-red-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
        <CardDescription>
          Irreversible and destructive actions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Label>Delete Account</Label>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all associated data
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteAccountClick}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Account
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

