"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Microscope } from "lucide-react"
import Link from "next/link"

export default function ConfirmationPage() {
  const router = useRouter()
  const [countdown, setCountdown] = useState(5)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verify authentication status
    const checkSession = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        setLoading(false)
        
        // Start countdown only if authentication was successful
        if (data.session) {
          const timer = setInterval(() => {
            setCountdown(prev => {
              if (prev <= 1) {
                clearInterval(timer)
                router.push('/dashboard')
                return 0
              }
              return prev - 1
            })
          }, 1000)
          
          return () => clearInterval(timer)
        }
      } catch (error) {
        console.error('Session verification error:', error)
        setLoading(false)
      }
    }
    
    checkSession()
  }, [router])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        {/* Background styles */}
        <div className="relative flex flex-col items-center justify-center min-h-screen p-6">
          <div className="w-full max-w-sm space-y-8">
            <Link href="/" className="flex items-center gap-2 justify-center hover:opacity-80 transition-opacity">
              <Microscope className="h-6 w-6 text-primary" />
              <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Pathology Bites
              </span>
            </Link>
            <Card className="w-full p-6 space-y-6">
              <div className="flex flex-col items-center gap-2 text-center">
                <Icons.spinner className="h-8 w-8 animate-spin text-primary" />
                <p className="text-gray-500">Verifying your account...</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Rest of the component */}
      <Card className="w-full p-6 space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center mb-2">
            <CheckIcon className="h-6 w-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Account Confirmed!</h1>
          <p className="text-gray-500">
            Your email has been verified. You will be redirected to the dashboard in {countdown} seconds.
          </p>
          <Link href="/dashboard" className="text-primary hover:underline">
            Click here if you are not redirected
          </Link>
        </div>
      </Card>
    </div>
  )
}