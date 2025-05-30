// src/app/(auth)/reset-password/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/shared/services/server'
import { resetPassword } from '@/features/auth/services/actions'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'
import { AuthCard } from '@/features/auth/components/ui/auth-card'
import { FormField } from '@/features/auth/components/ui/form-field'
import { FormButton } from '@/features/auth/components/ui/form-button'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'

interface ResetPasswordPageProps {
  searchParams: Promise<{ error?: string }> // Make this Promise-based
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { error } = await searchParams; // Await the searchParams
  
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?error=Invalid or expired reset link')
  }

  return (
    <AuthPageLayout maxWidth="sm">
      <AuthCard
        title="Create new password"
        description="Enter a new strong password for your account"
      >
        {error && ( // Use the awaited error variable
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form action={resetPassword} className="space-y-6">
          <FormField
            id="password"
            name="password"
            label="New Password"
            type="password"
            autoComplete="new-password"
            required
          />
          
          <div className="text-sm text-muted-foreground">
            <p>Password must:</p>
            <ul className="list-disc list-inside space-y-1 pl-4 mt-1">
              <li>Be at least 8 characters long</li>
              <li>Include at least one uppercase letter</li>
              <li>Include at least one lowercase letter</li>
              <li>Include at least one number</li>
            </ul>
          </div>
          
          <FormButton type="submit" fullWidth>
            Update Password
          </FormButton>
        </form>
      </AuthCard>
    </AuthPageLayout>
  )
}