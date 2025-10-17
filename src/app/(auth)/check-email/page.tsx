// app/(auth)/check-email/page.tsx
import Link from 'next/link'
import { Button } from "@/shared/components/ui/button"
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'
import { StatusCard } from '@/features/auth/components/ui/status-card'

export default function CheckEmailPage() {
  return (
    <AuthPageLayout>
      <StatusCard
        title="Check your email"
        description="We've sent you a password reset link"
        content="Please check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder."
        footer={
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">Back to login</Link>
          </Button>
        }
      />
    </AuthPageLayout>
  )
}