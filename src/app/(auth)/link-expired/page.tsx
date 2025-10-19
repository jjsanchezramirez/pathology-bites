// src/app/(auth)/link-expired/page.tsx
import Link from 'next/link'
import { Button } from "@/shared/components/ui/button"
import { AuthPageLayout } from '@/features/auth/components/ui/auth-page-layout'
import { StatusCard } from '@/features/auth/components/ui/status-card'

interface LinkExpiredPageProps {
  searchParams: Promise<{ type: string; email?: string }>
}

export default async function LinkExpiredPage({ searchParams }: LinkExpiredPageProps) {
  const params = await searchParams
  const { type, email } = params

  const getContent = () => {
    if (type === 'recovery') {
      return {
        title: 'Password Reset Link Expired',
        description: 'Your password reset link has expired or is no longer valid',
        content: 'Password reset links expire for security reasons. Please request a new password reset link to continue.',
        primaryAction: {
          href: '/forgot-password',
          text: 'Request New Reset Link'
        }
      }
    }

    // type === 'signup' or type === 'email'
    return {
      title: 'Verification Link Expired',
      description: 'Your email verification link has expired or is no longer valid',
      content: 'Email verification links expire for security reasons. Please request a new verification email to activate your account.',
      primaryAction: {
        href: email ? `/verify-email?email=${encodeURIComponent(email)}` : '/verify-email',
        text: 'Resend Verification Email'
      }
    }
  }

  const content = getContent()

  return (
    <AuthPageLayout>
      <StatusCard
        title={content.title}
        description={content.description}
        content={content.content}
        variant="warning"
        footer={
          <Button asChild className="w-full">
            <Link href={content.primaryAction.href}>
              {content.primaryAction.text}
            </Link>
          </Button>
        }
      />
    </AuthPageLayout>
  )
}
