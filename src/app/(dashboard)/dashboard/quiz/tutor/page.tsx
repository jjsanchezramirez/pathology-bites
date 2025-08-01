// src/app/(dashboard)/dashboard/quiz/tutor/page.tsx
"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { 
  Brain, 
  Play, 
  Settings, 
  Target,

  BookOpen,
  Lightbulb,
  TrendingUp
} from "lucide-react"

import Link from "next/link"

const tutorModeFeatures = [
  {
    icon: Lightbulb,
    title: "Immediate Feedback",
    description: "Get instant explanations after each answer to reinforce learning"
  },
  {
    icon: BookOpen,
    title: "Teaching Points",
    description: "Learn key concepts with detailed teaching points for every question"
  },
  {
    icon: Target,
    title: "Adaptive Learning",
    description: "Focus on areas where you need the most improvement"
  },
  {
    icon: TrendingUp,
    title: "Progress Tracking",
    description: "Monitor your improvement over time with detailed analytics"
  }
]

const quickStartOptions = [
  {
    id: "quick-review",
    title: "Quick Review",
    description: "10 questions, mixed difficulty",
    duration: "10-15 min",
    questionCount: 10,
    difficulty: "mixed" as const,
    icon: "⚡"
  },
  {
    id: "focused-study",
    title: "Focused Study",
    description: "25 questions, specific category",
    duration: "25-35 min",
    questionCount: 25,
    difficulty: "medium" as const,
    icon: "🎯"
  },
  {
    id: "comprehensive",
    title: "Comprehensive",
    description: "50 questions, all categories",
    duration: "45-60 min",
    questionCount: 50,
    difficulty: "mixed" as const,
    icon: "📚"
  },
  {
    id: "weak-areas",
    title: "Weak Areas",
    description: "Adaptive questions based on past performance",
    duration: "20-30 min",
    questionCount: 20,
    difficulty: "adaptive" as const,
    icon: "💪"
  }
]

const recentTopics = [
  { name: "Glomerular Diseases", accuracy: 78, lastStudied: "2 days ago" },
  { name: "Tubular Disorders", accuracy: 85, lastStudied: "1 week ago" },
  { name: "Vascular Pathology", accuracy: 92, lastStudied: "3 days ago" },
  { name: "Neoplasms", accuracy: 65, lastStudied: "5 days ago" }
]

export default function TutorModePage() {
  const [selectedOption, setSelectedOption] = useState<string | null>(null)

  const handleStartQuiz = (optionId: string) => {
    // TODO: Create quiz session with tutor mode configuration
    console.log("Starting tutor mode quiz:", optionId)
    // Redirect to quiz creation with pre-filled tutor mode settings
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <Brain className="h-12 w-12 text-primary" />
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tutor Mode</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Learn with immediate feedback and detailed explanations. Perfect for building understanding 
            and reinforcing key concepts in pathology.
          </p>
        </div>
      </div>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Why Choose Tutor Mode?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {tutorModeFeatures.map((feature, index) => (
              <div key={index} className="text-center space-y-3">
                <div className="flex justify-center">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Start Options */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5" />
                Quick Start
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {quickStartOptions.map((option) => (
                  <div
                    key={option.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedOption === option.id 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedOption(option.id)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="text-2xl">{option.icon}</div>
                        <Badge variant="outline" className="text-xs">
                          {option.duration}
                        </Badge>
                      </div>
                      <div>
                        <h3 className="font-semibold">{option.title}</h3>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{option.questionCount} questions</span>
                        <span className="capitalize">{option.difficulty} difficulty</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 flex gap-3">
                <Button 
                  className="flex-1" 
                  disabled={!selectedOption}
                  onClick={() => selectedOption && handleStartQuiz(selectedOption)}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start Selected Quiz
                </Button>
                <Link href="/dashboard/quiz/new" className="flex-1">
                  <Button variant="outline" className="w-full">
                    <Settings className="h-4 w-4 mr-2" />
                    Custom Settings
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Performance */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Recent Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {recentTopics.map((topic, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{topic.name}</span>
                    <span className={`text-sm ${
                      topic.accuracy >= 80 ? 'text-green-600' : 
                      topic.accuracy >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {topic.accuracy}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last studied: {topic.lastStudied}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className={`h-1.5 rounded-full ${
                        topic.accuracy >= 80 ? 'bg-green-500' : 
                        topic.accuracy >= 70 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${topic.accuracy}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Study Streak</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-2">
              <div className="text-3xl font-bold text-primary">12</div>
              <div className="text-sm text-muted-foreground">days in a row</div>
              <div className="text-xs text-muted-foreground">
                Keep it up! You're on fire 🔥
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today's Goal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Questions answered</span>
                <span>8/15</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-primary h-2 rounded-full" style={{ width: '53%' }} />
              </div>
              <div className="text-xs text-muted-foreground text-center">
                7 more questions to reach your daily goal
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5" />
            Tutor Mode Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Read Carefully</h4>
              <p className="text-sm text-muted-foreground">
                Take your time to read each question thoroughly before selecting an answer.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Learn from Mistakes</h4>
              <p className="text-sm text-muted-foreground">
                Pay special attention to explanations for questions you get wrong.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Review Teaching Points</h4>
              <p className="text-sm text-muted-foreground">
                Teaching points provide valuable context and help reinforce key concepts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
