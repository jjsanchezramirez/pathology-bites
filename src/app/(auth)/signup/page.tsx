// src/app/(auth)/signup/page.tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { signup } from '@/lib/auth/actions'
import { AuthPageLayout } from '@/components/auth/ui/auth-page-layout'
import { AuthCard } from '@/components/auth/ui/auth-card'
import { FormField } from '@/components/auth/ui/form-field'
import { FormButton } from '@/components/auth/ui/form-button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface SignupPageProps {
  searchParams: Promise<{ error?: string }>
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  // Await searchParams for Next.js 15
  const params = await searchParams
  
  // Check if user is already authenticated
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (user) {
    redirect('/dashboard')
  }

  return (
    <AuthPageLayout maxWidth="md">
      <AuthCard
        title="Create your account"
        description="Join Pathology Bites to start learning"
        showPrivacyFooter
      >
        {params.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{params.error}</AlertDescription>
          </Alert>
        )}

        <form action={signup} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              id="firstName"
              name="firstName"
              label="First Name"
              placeholder="John"
              required
            />
            <FormField
              id="lastName"
              name="lastName"
              label="Last Name"
              placeholder="Doe"
              required
            />
          </div>
          
          <FormField
            id="email"
            name="email"
            label="Email"
            type="email"
            placeholder="name@example.com"
            autoComplete="email"
            required
          />
          
          <FormField
            id="userType"
            name="userType"
            label="What best describes you?"
            required
          >
            <Select name="userType" defaultValue="student" required>
              <SelectTrigger>
                <SelectValue placeholder="Select your role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="resident">Resident</SelectItem>
                <SelectItem value="fellow">Fellow</SelectItem>
                <SelectItem value="attending">Attending</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          
          <FormField
            id="password"
            name="password"
            label="Password"
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
            Create Account
          </FormButton>
          
          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link 
              href="/login" 
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              Log in
            </Link>
          </div>
        </form>
      </AuthCard>
    </AuthPageLayout>
  )
}