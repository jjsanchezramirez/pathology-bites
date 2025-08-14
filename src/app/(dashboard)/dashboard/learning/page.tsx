// src/app/(dashboard)/dashboard/learning/page.tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"
import { Badge } from "@/shared/components/ui/badge"
import { Skeleton } from "@/shared/components/ui/skeleton"
import {
  BookOpen,
  CheckCircle,
  Lock,
  Play,
  Clock,
  Target,
  ChevronRight,

  TrendingUp,
  ArrowRight,
  Star,
  GraduationCap,

} from "lucide-react"
import { LEARNING_MODULES, getAllSubModules } from "@/features/learning-path/data/learning-categories"
import { LearningCategory } from "@/features/learning-path/types/learning-path"

export default function LearningPage() {
  const [learningData, setLearningData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedModule, setSelectedModule] = useState<string | null>(null)

  // Fetch learning data from optimized API
  useEffect(() => {
    const fetchLearningData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/learning')
        
        if (!response.ok) {
          throw new Error('Failed to fetch learning data')
        }
        
        const result = await response.json()
        setLearningData(result.data)
      } catch (err) {
        console.error('Error fetching learning data:', err)
        setError('Failed to load learning modules')
        // Fallback to static data
        setLearningData({
          modules: LEARNING_MODULES,
          overallStats: {
            totalModules: 12,
            completedModules: 0,
            progressPercentage: 0
          }
        })
      } finally {
        setLoading(false)
      }
    }

    fetchLearningData()
  }, [])

  // Use data from API or fallback to static data
  const modules = learningData?.modules || LEARNING_MODULES
  const overallStats = learningData?.overallStats || { totalModules: 12, completedModules: 0, progressPercentage: 0 }

  // Calculate additional stats
  const inProgressModules = modules.reduce((count: number, module: LearningCategory) => 
    count + module.modules.filter(m => m.status === 'in_progress').length, 0
  )
  const availableModules = modules.reduce((count: number, module: LearningCategory) => 
    count + module.modules.filter(m => m.status === 'available').length, 0
  )

  const LoadingSkeleton = () => (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-96" />
      </div>
      
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  if (loading) {
    return <LoadingSkeleton />
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Modules</h1>
        <p className="text-muted-foreground">
          Master pathology through structured learning modules focused on bone and soft tissue pathology
        </p>
      </div>

      {/* Stats Cards - Following dashboard pattern */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{overallStats.completedModules}</div>
            <p className="text-xs text-muted-foreground">
              Modules finished
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressModules}</div>
            <p className="text-xs text-muted-foreground">
              Currently learning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available</CardTitle>
            <BookOpen className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{availableModules}</div>
            <p className="text-xs text-muted-foreground">
              Ready to start
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{overallStats.progressPercentage}%</div>
            <p className="text-xs text-muted-foreground">
              Overall completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Learning Modules - Full Width */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Learning Modules</h2>
        
        {error ? (
          <Card className="p-6 text-center border-destructive">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">Try Again</Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {modules.map((module: LearningCategory) => (
              <div key={module.id} className="space-y-4">
                <ExpandableModuleCard 
                  module={module} 
                  isSelected={selectedModule === module.id}
                  onToggle={() => setSelectedModule(selectedModule === module.id ? null : module.id)}
                />
                
                {/* Submodules - Horizontal Scrolling */}
                {selectedModule === module.id && (
                  <div className="ml-4 space-y-3">
                    <h3 className="text-lg font-semibold text-muted-foreground flex items-center gap-2">
                      <GraduationCap className="h-5 w-5" />
                      Module Contents
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-4">
                      {module.modules.map((subModule, index) => (
                        <SubModuleCard 
                          key={subModule.id} 
                          subModule={subModule} 
                          parentModule={module}
                          index={index}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center">
                      ← Scroll horizontally to see all modules →
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Expandable Module Card Component
function ExpandableModuleCard({ 
  module, 
  isSelected, 
  onToggle 
}: { 
  module: LearningCategory
  isSelected: boolean
  onToggle: () => void
}) {
  const availableModules = module.modules.filter(m => m.status === 'available' || m.status === 'in_progress').length
  const nextModule = module.modules.find(m => m.status === 'available' || m.status === 'in_progress')
  
  return (
    <Card 
      className={`cursor-pointer transition-all duration-200 hover:shadow-lg border-2 ${
        isSelected 
          ? 'border-primary shadow-lg' 
          : 'border-border hover:border-primary/50'
      }`}
      onClick={onToggle}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 rounded-xl ${module.color} flex items-center justify-center text-white text-2xl shrink-0`}>
            {module.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-bold text-xl">{module.name}</h3>
              <Badge variant="outline" className="shrink-0">
                {module.completedModules}/{module.totalModules}
              </Badge>
            </div>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              {module.description}
            </p>
            <div className="space-y-3">
              <div className="flex justify-between text-sm font-medium">
                <span>Progress</span>
                <span>{Math.round(module.progress)}%</span>
              </div>
              <Progress value={module.progress} className="w-full h-2" />
              {nextModule && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Play className="h-4 w-4" />
                  <span>Next: {nextModule.name}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-3 shrink-0">
            <Link href={`/dashboard/learning/${module.id}`} onClick={(e) => e.stopPropagation()}>
              <Button size="lg" className="px-6">
                {module.progress > 0 ? 'Continue' : 'Start Learning'}
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            {availableModules > 0 && (
              <Badge variant="secondary" className="text-xs">
                {availableModules} available
              </Badge>
            )}
            <div className="text-xs text-muted-foreground">
              {isSelected ? 'Click to collapse' : 'Click to expand'}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// SubModule Card Component for horizontal scrolling
function SubModuleCard({ 
  subModule, 
  parentModule,
  index 
}: { 
  subModule: any
  parentModule: LearningCategory
  index: number 
}) {
  const getStatusIcon = () => {
    switch (subModule.status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'in_progress':
        return <Play className="h-5 w-5 text-blue-500" />
      case 'available':
        return <BookOpen className="h-5 w-5 text-orange-500" />
      default:
        return <Lock className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (subModule.status) {
      case 'completed':
        return 'border-green-200 bg-green-50'
      case 'in_progress':
        return 'border-blue-200 bg-blue-50'
      case 'available':
        return 'border-orange-200 bg-orange-50 hover:bg-orange-100'
      default:
        return 'border-gray-200 bg-gray-50'
    }
  }

  const isClickable = ['available', 'in_progress', 'completed'].includes(subModule.status)

  return (
    <Card 
      className={`w-80 shrink-0 transition-all duration-200 ${getStatusColor()} ${
        isClickable ? 'cursor-pointer hover:shadow-md hover:scale-105' : 'cursor-not-allowed opacity-75'
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              subModule.status === 'completed' ? 'bg-green-500 text-white' :
              subModule.status === 'in_progress' ? 'bg-blue-500 text-white' :
              subModule.status === 'available' ? 'bg-orange-500 text-white' :
              'bg-gray-300 text-gray-600'
            }`}>
              {index + 1}
            </span>
            {getStatusIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-base mb-1 line-clamp-2">{subModule.name}</h4>
            <p className="text-sm text-muted-foreground line-clamp-3">{subModule.description}</p>
          </div>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{subModule.estimatedHours}h</span>
            </div>
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              <span>{subModule.questionCount} questions</span>
            </div>
          </div>
          
          {subModule.status === 'in_progress' && subModule.progress && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>Progress</span>
                <span>{subModule.progress}%</span>
              </div>
              <Progress value={subModule.progress} className="h-1" />
            </div>
          )}
          
          {subModule.status === 'completed' && subModule.score && (
            <div className="flex items-center gap-1 text-sm text-green-600">
              <Star className="h-4 w-4 fill-current" />
              <span>{subModule.score}% score</span>
            </div>
          )}
        </div>
        
        {isClickable && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <Link href={`/dashboard/learning/${parentModule.id}/${subModule.id}`}>
              <Button size="sm" variant={subModule.status === 'completed' ? 'outline' : 'default'} className="w-full">
                {subModule.status === 'completed' ? 'Review' : 
                 subModule.status === 'in_progress' ? 'Continue' : 'Start'}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
          </div>
        )}
        
        {subModule.status === 'locked' && subModule.prerequisites && (
          <div className="mt-4 pt-3 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Complete: {subModule.prerequisites.join(', ')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}