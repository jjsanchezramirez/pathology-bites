// src/app/(dashboard)/dashboard/learning-path/page.tsx
"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"
import { Badge } from "@/shared/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import {
  BookOpen,

  Clock,
  Target,
  Microscope,
  FlaskConical,
  ChevronRight,
  Trophy,
  TrendingUp
} from "lucide-react"
import { AP_CATEGORIES, CP_CATEGORIES } from "@/features/learning-path/data/learning-categories"
import { LearningCategory } from "@/features/learning-path/types/learning-path"

export default function LearningPathPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'ap' | 'cp'>('overview')

  // Calculate overall stats
  const allCategories = [...AP_CATEGORIES, ...CP_CATEGORIES]
  const totalModules = allCategories.reduce((sum, cat) => sum + cat.totalModules, 0)
  const completedModules = allCategories.reduce((sum, cat) => sum + cat.completedModules, 0)
  const overallProgress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0

  const apTotalModules = AP_CATEGORIES.reduce((sum, cat) => sum + cat.totalModules, 0)
  const apCompletedModules = AP_CATEGORIES.reduce((sum, cat) => sum + cat.completedModules, 0)
  const apProgress = apTotalModules > 0 ? (apCompletedModules / apTotalModules) * 100 : 0

  const cpTotalModules = CP_CATEGORIES.reduce((sum, cat) => sum + cat.totalModules, 0)
  const cpCompletedModules = CP_CATEGORIES.reduce((sum, cat) => sum + cat.completedModules, 0)
  const cpProgress = cpTotalModules > 0 ? (cpCompletedModules / cpTotalModules) * 100 : 0

  const CategoryCard = ({ category }: { category: LearningCategory }) => {
    const availableModules = category.modules.filter(m => m.status === 'available' || m.status === 'in_progress').length
    const nextModule = category.modules.find(m => m.status === 'available' || m.status === 'in_progress')

    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-lg ${category.color} flex items-center justify-center text-white text-xl shrink-0`}>
              {category.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-lg truncate">{category.name}</h3>
                <Badge variant="outline" className="shrink-0">
                  {category.completedModules}/{category.totalModules}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {category.description}
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Progress</span>
                  <span>{Math.round(category.progress)}%</span>
                </div>
                <Progress value={category.progress} className="w-full" />
                {nextModule && (
                  <p className="text-sm text-muted-foreground">
                    Next: {nextModule.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <Link href={`/dashboard/learning-path/${category.id}`}>
                <Button size="sm" className="w-full">
                  {category.progress > 0 ? 'Continue' : 'Start'}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
              {availableModules > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {availableModules} available
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Path</h1>
        <p className="text-muted-foreground">
          Follow a structured curriculum designed for pathology mastery
        </p>
      </div>

      {/* Overall Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Overall Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Pathology Learning Track</span>
            <span>{completedModules}/{totalModules} modules completed</span>
          </div>
          <Progress value={overallProgress} className="w-full" />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Microscope className="h-4 w-4 text-blue-500" />
              <span>AP: {Math.round(apProgress)}% ({apCompletedModules}/{apTotalModules})</span>
            </div>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-green-500" />
              <span>CP: {Math.round(cpProgress)}% ({cpCompletedModules}/{cpTotalModules})</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for AP/CP */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'overview' | 'ap' | 'cp')}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ap" className="flex items-center gap-2">
            <Microscope className="h-4 w-4" />
            Anatomic Pathology
          </TabsTrigger>
          <TabsTrigger value="cp" className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Clinical Pathology
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="text-2xl font-bold">{completedModules}</p>
                    <p className="text-sm text-muted-foreground">Modules Completed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold">{Math.round(overallProgress)}%</p>
                    <p className="text-sm text-muted-foreground">Overall Progress</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{totalModules - completedModules}</p>
                    <p className="text-sm text-muted-foreground">Modules Remaining</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity / Recommendations */}
          <Card>
            <CardHeader>
              <CardTitle>Continue Learning</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Show categories with in-progress modules */}
                {allCategories
                  .filter(cat => cat.modules.some(m => m.status === 'in_progress'))
                  .slice(0, 2)
                  .map(category => {
                    const inProgressModule = category.modules.find(m => m.status === 'in_progress')
                    return (
                      <div key={category.id} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                        <div className={`w-8 h-8 rounded ${category.color} flex items-center justify-center text-white text-sm shrink-0`}>
                          {category.icon}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{category.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Continue with: {inProgressModule?.name}
                          </p>
                        </div>
                        <Link href={`/dashboard/learning-path/${category.id}`}>
                          <Button size="sm">Continue</Button>
                        </Link>
                      </div>
                    )
                  })}

                {/* Show available categories if no in-progress */}
                {allCategories.filter(cat => cat.modules.some(m => m.status === 'in_progress')).length === 0 && (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <BookOpen className="h-5 w-5 text-green-500 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">Ready to start learning?</p>
                      <p className="text-sm text-muted-foreground">
                        Choose from Anatomic Pathology or Clinical Pathology tracks to begin your journey.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ap" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Anatomic Pathology</h2>
              <p className="text-muted-foreground">
                Tissue-based diagnosis and morphological pathology
              </p>
            </div>
            <Badge variant="outline">
              {apCompletedModules}/{apTotalModules} modules
            </Badge>
          </div>
          <div className="grid gap-4">
            {AP_CATEGORIES.map(category => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="cp" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Clinical Pathology</h2>
              <p className="text-muted-foreground">
                Laboratory medicine and diagnostic testing
              </p>
            </div>
            <Badge variant="outline">
              {cpCompletedModules}/{cpTotalModules} modules
            </Badge>
          </div>
          <div className="grid gap-4">
            {CP_CATEGORIES.map(category => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
