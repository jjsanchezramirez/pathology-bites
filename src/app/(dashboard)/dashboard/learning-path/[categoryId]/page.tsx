// src/app/(dashboard)/dashboard/learning-path/[categoryId]/page.tsx
"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"
import { Badge } from "@/shared/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import {
  ArrowLeft,
  CheckCircle,
  Circle,
  Lock,
  Play,
  Star,
  Clock,
  Target,
  Trophy,
  BookOpen,
  List,
  GitBranch
} from "lucide-react"
import { getCategoryById } from "@/features/learning-path/data/learning-categories"
import { LearningCategory, LearningModule } from "@/features/learning-path/types/learning-path"
import { VisualLearningPath } from "@/features/learning-path/components/visual-learning-path"

export default function CategoryLearningPathPage() {
  const params = useParams()
  const router = useRouter()
  const categoryId = params.categoryId as string

  const [category, setCategory] = useState<LearningCategory | null>(null)
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'path'>('path')

  useEffect(() => {
    const foundCategory = getCategoryById(categoryId)
    setCategory(foundCategory || null)
    setLoading(false)
  }, [categoryId])

  if (loading) {
    return <div>Loading...</div>
  }

  if (!category) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/learning-path">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Learning Path
            </Button>
          </Link>
        </div>
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold mb-2">Category Not Found</h1>
          <p className="text-muted-foreground">The learning path category you're looking for doesn't exist.</p>
        </div>
      </div>
    )
  }

  const ModuleCard = ({ module, index }: { module: LearningModule; index: number }) => {
    const isCompleted = module.status === 'completed'
    const isInProgress = module.status === 'in_progress'
    const isAvailable = module.status === 'available'
    const isLocked = module.status === 'locked'

    return (
      <Card className={`
        relative transition-all duration-200 hover:shadow-md
        ${isCompleted ? 'border-green-200 bg-green-50/50' : ''}
        ${isInProgress ? 'border-blue-200 bg-blue-50/50' : ''}
        ${isLocked ? 'opacity-60' : ''}
      `}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            {/* Status Icon */}
            <div className="shrink-0 mt-1">
              {isCompleted && <CheckCircle className="h-6 w-6 text-green-500" />}
              {isInProgress && <Circle className="h-6 w-6 text-blue-500" />}
              {isAvailable && <Circle className="h-6 w-6 text-gray-400" />}
              {isLocked && <Lock className="h-6 w-6 text-gray-400" />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <h3 className={`font-semibold text-lg ${isLocked ? 'text-gray-600' : ''}`}>
                  {index + 1}. {module.name}
                </h3>
                {isCompleted && <Badge className="bg-green-100 text-green-800">Completed</Badge>}
                {isInProgress && <Badge variant="secondary">In Progress</Badge>}
                {isLocked && <Badge variant="outline">Locked</Badge>}
              </div>
              
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {module.description}
              </p>

              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                <span>{module.questionCount} questions</span>
                <span>•</span>
                <span>{module.estimatedHours}h estimated</span>
                {module.score && (
                  <>
                    <span>•</span>
                    <span className="text-green-600 font-medium">Score: {module.score}%</span>
                  </>
                )}
              </div>

              {/* Progress bar for in-progress modules */}
              {isInProgress && module.progress && (
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.round(module.progress)}%</span>
                  </div>
                  <Progress value={module.progress} className="w-full" />
                </div>
              )}

              {/* Prerequisites info for locked modules */}
              {isLocked && module.prerequisites && module.prerequisites.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  <span>Requires completion of previous modules</span>
                </div>
              )}
            </div>

            {/* Action Button */}
            <div className="shrink-0">
              {isCompleted && (
                <Button variant="outline" size="sm">
                  Review
                </Button>
              )}
              {isInProgress && (
                <Button size="sm">
                  <Play className="h-4 w-4 mr-2" />
                  Continue
                </Button>
              )}
              {isAvailable && (
                <Button size="sm">
                  Start
                </Button>
              )}
              {isLocked && (
                <Button variant="outline" size="sm" disabled>
                  <Lock className="h-4 w-4 mr-2" />
                  Locked
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/learning-path">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Learning Path
          </Button>
        </Link>
      </div>

      {/* Category Header */}
      <div className="flex items-start gap-4">
        <div className={`w-16 h-16 rounded-xl ${category.color} flex items-center justify-center text-white text-2xl shrink-0`}>
          {category.icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-3xl font-bold tracking-tight">{category.name}</h1>
            <Badge variant="outline" className="text-sm">
              {category.type.toUpperCase()}
            </Badge>
          </div>
          <p className="text-muted-foreground text-lg mb-4">
            {category.description}
          </p>
          
          {/* Progress Overview */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Overall Progress</span>
              <span>{category.completedModules}/{category.totalModules} modules completed</span>
            </div>
            <Progress value={category.progress} className="w-full max-w-md" />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{category.completedModules}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{Math.round(category.progress)}%</p>
                <p className="text-sm text-muted-foreground">Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{category.totalModules - category.completedModules}</p>
                <p className="text-sm text-muted-foreground">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-2xl font-bold">
                  {category.modules
                    .filter(m => m.status !== 'completed')
                    .reduce((sum, m) => sum + m.estimatedHours, 0)}h
                </p>
                <p className="text-sm text-muted-foreground">Remaining</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Learning Path - Modules */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Learning Modules</h2>
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as 'list' | 'path')}>
            <TabsList>
              <TabsTrigger value="path" className="flex items-center gap-2">
                <GitBranch className="h-4 w-4" />
                Path View
              </TabsTrigger>
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                List View
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {viewMode === 'path' ? (
          <VisualLearningPath modules={category.modules} categoryColor={category.color || 'bg-gray-500'} />
        ) : (
          <div className="space-y-4">
            {category.modules
              .sort((a, b) => a.order - b.order)
              .map((module, index) => (
                <ModuleCard key={module.id} module={module} index={index} />
              ))}
          </div>
        )}
      </div>

      {/* Next Steps / Recommendations */}
      {category.progress < 100 && (
        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                const nextModule = category.modules
                  .sort((a, b) => a.order - b.order)
                  .find(m => m.status === 'available' || m.status === 'in_progress')
                
                if (nextModule) {
                  return (
                    <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <Play className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {nextModule.status === 'in_progress' ? 'Continue with' : 'Start'}: {nextModule.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {nextModule.description}
                        </p>
                      </div>
                      <Button size="sm">
                        {nextModule.status === 'in_progress' ? 'Continue' : 'Start'}
                      </Button>
                    </div>
                  )
                }
                
                return (
                  <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                    <Trophy className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-sm">Congratulations!</p>
                      <p className="text-sm text-muted-foreground">
                        You've completed all modules in this category. Consider reviewing or exploring other categories.
                      </p>
                    </div>
                  </div>
                )
              })()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
