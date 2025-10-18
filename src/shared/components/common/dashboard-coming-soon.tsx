// src/shared/components/common/dashboard-coming-soon.tsx
'use client'

import { Button } from "@/shared/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Construction, ArrowLeft, MessageSquare } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

interface DashboardComingSoonProps {
  title: string
  description?: string
  expectedDate?: string
  showBackButton?: boolean
  backHref?: string
  className?: string
}

export function DashboardComingSoon({
  title,
  description = "We're working hard to bring you this feature. Stay tuned for updates!",
  expectedDate = "Coming Soon",
  showBackButton = true,
  backHref = "/dashboard",
  className = ""
}: DashboardComingSoonProps) {
  const router = useRouter()

  const handleBack = () => {
    if (backHref) {
      router.push(backHref)
    } else {
      router.back()
    }
  }

  return (
    <div className={`container mx-auto px-4 py-8 max-w-4xl ${className}`}>
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8">
        {/* Icon and Status */}
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center">
              <Construction className="w-12 h-12 text-primary" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white text-xs font-bold">!</span>
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            <p className="text-lg text-muted-foreground max-w-md">{description}</p>
          </div>
        </div>

        {/* Status Card */}
        <Card className="w-full max-w-md">
          <CardHeader className="text-center pb-3">
            <CardTitle className="text-lg">Development Status</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">{expectedDate}</div>
              <p className="text-sm text-muted-foreground">
                This feature is currently under development and will be available soon.
              </p>
            </div>
            
            {/* Progress indicator */}
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full w-3/4 transition-all duration-300"></div>
            </div>
            <p className="text-xs text-muted-foreground">Development Progress: ~75%</p>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          {showBackButton && (
            <Button
              onClick={handleBack}
              variant="outline"
              className="flex items-center gap-2 flex-1"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          )}
          
          <Link href="https://discord.gg/2v64p2fzsC" target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button className="w-full flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Join Discord for Updates
            </Button>
          </Link>
        </div>

        {/* Additional Info */}
        <div className="text-center space-y-2 max-w-lg">
          <p className="text-sm text-muted-foreground">
            Want to be notified when this feature launches? Join our Discord community 
            to get the latest updates and connect with other pathology students.
          </p>
        </div>
      </div>
    </div>
  )
}

// Preset configurations for common dashboard features
export const DashboardComingSoonPresets = {
  newQuiz: {
    title: "Quiz Creation",
    description: "Create custom quizzes tailored to your learning needs. Choose topics, difficulty levels, and question types.",
    expectedDate: "February 2025"
  },
  myQuizzes: {
    title: "Quiz History",
    description: "View your completed quizzes, track your progress, and review your performance over time.",
    expectedDate: "February 2025"
  },
  learningModules: {
    title: "Learning Modules",
    description: "Structured learning paths covering key pathology topics with interactive content and assessments.",
    expectedDate: "March 2025"
  },
  performance: {
    title: "Performance Analytics",
    description: "Detailed analytics on your learning progress, strengths, weaknesses, and improvement areas.",
    expectedDate: "February 2025"
  },
  goals: {
    title: "Learning Goals",
    description: "Set and track your learning objectives with personalized goal management and progress tracking.",
    expectedDate: "March 2025"
  }
}
