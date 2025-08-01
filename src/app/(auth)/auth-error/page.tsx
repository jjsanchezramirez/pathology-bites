// app/(auth)/auth-error/page.tsx
import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'
import { StatusCard } from '@/features/auth/components/ui/status-card'

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string; description?: string }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams
  const description = params.description

  // Check if coming soon or maintenance mode is enabled
  const isComingSoonMode = process.env.NEXT_PUBLIC_COMING_SOON_MODE === 'true'
  const isMaintenanceMode = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true'
  const isAdminOnlyMode = isComingSoonMode || isMaintenanceMode

  return (
    <AuthPageLayout>
      <StatusCard
        title="Authentication Error"
        description={description || 'An error occurred during authentication'}
        content={
          description && (
            <div className="text-sm text-muted-foreground text-center bg-muted p-3 rounded">
              {description}
            </div>
          )
        }
        footer={
          <div className="flex flex-col gap-2 w-full">
            <Button asChild className="w-full">
              <Link href="/login">Back to Login</Link>
            </Button>

            {!isAdminOnlyMode && (
              <Button variant="outline" asChild className="w-full">
                <Link href="/signup">Create New Account</Link>
              </Button>
            )}
          </div>
        }
        variant="error"
      />
    </AuthPageLayout>
  )
}