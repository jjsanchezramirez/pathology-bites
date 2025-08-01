// src/app/(auth)/reset-password/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/shared/services/server'
import { ResetPasswordForm } from '@/features/auth/components/forms/reset-password-form'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'

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
      <ResetPasswordForm initialError={error} />
    </AuthPageLayout>
  )
}