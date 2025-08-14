// src/app/(dashboard)/dashboard/learning/[moduleId]/page.tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"

import { Skeleton } from "@/shared/components/ui/skeleton"
import {
  BookOpen,
  CheckCircle,
  Lock,
  Play,
  Clock,
  Target,

  ChevronLeft,
  ArrowRight,
  Star,
  GraduationCap,

  FileText,
  Award
} from "lucide-react"
import { getModuleById } from "@/features/learning-path/data/learning-categories"
import { LearningCategory } from "@/features/learning-path/types/learning-path"

export default function ModuleOverviewPage() {
  const params = useParams()
  const router = useRouter()
  const moduleId = params.moduleId as string

  const [module, setModule] = useState<LearningCategory | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchModule = async () => {
      try {
        setLoading(true)
        
        // For now, get from static data
        const moduleData = getModuleById(moduleId)
        
        if (!moduleData) {
          router.push('/dashboard/learning')
          return
        }
        
        setModule(moduleData)
      } catch (error) {
        console.error('Error fetching module:', error)
        router.push('/dashboard/learning')
      } finally {
        setLoading(false)
      }
    }

    if (moduleId) {
      fetchModule()
    }
  }, [moduleId, router])

  const getStatusIcon = (status: string) => {
    switch (status) {
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

  const getStatusColor = (status: string) => {
    switch (status) {
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

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
        </div>
        
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 overflow-x-hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="w-80 h-48 shrink-0" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!module) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Module not found</h1>
        <Link href="/dashboard/learning">
          <Button>Back to Learning Modules</Button>
        </Link>
      </div>
    )
  }

  const completedSubModules = module.modules.filter(m => m.status === 'completed').length
  const inProgressSubModules = module.modules.filter(m => m.status === 'in_progress').length
  const availableSubModules = module.modules.filter(m => m.status === 'available').length
  const totalQuestions = module.modules.reduce((sum, m) => sum + m.questionCount, 0)
  const totalHours = module.modules.reduce((sum, m) => sum + m.estimatedHours, 0)

  return (
    <div className="space-y-6">
      {/* Breadcrumb and Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/learning">
          <Button variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <span className={`w-12 h-12 rounded-xl ${module.color} flex items-center justify-center text-white text-xl`}>
              {module.icon}
            </span>
            {module.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {module.description}
          </p>
        </div>
      </div>

      {/* Module Stats Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedSubModules}</div>
            <p className="text-xs text-muted-foreground">
              Lessons finished
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Play className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{inProgressSubModules}</div>
            <p className="text-xs text-muted-foreground">
              Currently learning
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Questions</CardTitle>
            <FileText className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{totalQuestions}</div>
            <p className="text-xs text-muted-foreground">
              Total practice questions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalHours}h</div>
            <p className="text-xs text-muted-foreground">
              Estimated time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Module Progress
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center text-sm">
            <span className="font-medium">Overall Completion</span>
            <span className="font-bold">{completedSubModules}/{module.totalModules}</span>
          </div>
          <Progress value={module.progress} className="w-full h-3" />
          <div className="grid grid-cols-3 gap-4 text-center text-sm">
            <div className="space-y-1">
              <div className="text-lg font-bold text-green-600">{completedSubModules}</div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-blue-600">{inProgressSubModules}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
            <div className="space-y-1">
              <div className="text-lg font-bold text-orange-600">{availableSubModules}</div>
              <div className="text-xs text-muted-foreground">Available</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Learning Modules - Horizontal Scrolling */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-500" />
            Learning Modules
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Complete modules in order to unlock the next ones
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-6 overflow-x-auto pb-4">
            {module.modules.map((subModule, index) => {
              const isClickable = ['available', 'in_progress', 'completed'].includes(subModule.status)
              
              return (
                <Card 
                  key={subModule.id}
                  className={`w-80 shrink-0 transition-all duration-200 ${getStatusColor(subModule.status)} ${
                    isClickable ? 'cursor-pointer hover:shadow-md hover:scale-105' : 'cursor-not-allowed opacity-75'
                  }`}
                >
                  <CardContent className="p-6">
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
                        {getStatusIcon(subModule.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-base mb-1 line-clamp-2">{subModule.name}</h4>
                        <p className="text-sm text-muted-foreground line-clamp-3">{subModule.description}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
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
                          <Progress value={subModule.progress} className="h-2" />
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
                        <Link href={`/dashboard/learning/${moduleId}/${subModule.id}`}>
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
            })}
          </div>
          
          {/* Navigation hint */}
          <p className="text-xs text-muted-foreground text-center mt-2">
            ← Scroll horizontally to see all modules →
          </p>
        </CardContent>
      </Card>
    </div>
  )
}