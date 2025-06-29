// src/app/(auth)/signup/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/shared/services/server'
import { SignupForm } from '@/features/auth/components/forms/signup-form'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'

export default async function SignupPage() {
  // Check if user is already authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <AuthPageLayout maxWidth="md">
      <SignupForm />
    </AuthPageLayout>
  )
}