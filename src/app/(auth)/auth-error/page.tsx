// app/(auth)/auth-error/page.tsx
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { StatusCard } from '@/components/auth/ui/status-card'

interface AuthErrorPageProps {
  searchParams: Promise<{ error?: string; description?: string }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const params = await searchParams
  const error = params.error
  const description = params.description

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
            
            <Button variant="outline" asChild className="w-full">
              <Link href="/signup">Create New Account</Link>
            </Button>
          </div>
        }
        variant="error"
      />
    </AuthPageLayout>
  )
}