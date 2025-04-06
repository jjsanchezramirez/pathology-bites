// src/app/(auth)/check-email/page.tsx
"use client"

import { Microscope } from "lucide-react"
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Icons } from "@/components/theme/icons"

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(56,189,248,0.08),transparent_25%),radial-gradient(circle_at_70%_50%,rgba(56,189,248,0.08),transparent_25%),linear-gradient(to_bottom,rgba(56,189,248,0.05),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.15]" />
      
      <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-full max-w-md space-y-8">
          <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
            <Microscope className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Pathology Bites
            </span>
          </Link>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Icons.mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Check your email</CardTitle>
              <CardDescription>
                We've sent you a password reset link
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground">
                Please check your email for a link to reset your password. If it doesn't appear within a few minutes, check your spam folder.
              </p>
            </CardContent>
            <CardFooter className="flex justify-center">
              <Button 
                variant="outline"
                asChild
              >
                <Link href="/login">Back to login</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}