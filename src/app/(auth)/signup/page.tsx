// src/app/(auth)/signup/page.tsx
import { SignupForm } from '@/features/auth/components/forms/signup-form'
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'

export default function SignupPage() {
  // Note: Authentication check moved to client-side to avoid cookies() during build
  // The SignupForm component will handle redirecting authenticated users

  return (
    <AuthPageLayout maxWidth="md">
      <SignupForm />
    </AuthPageLayout>
  )
}