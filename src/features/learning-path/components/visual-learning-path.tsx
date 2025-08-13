// src/features/learning-path/components/visual-learning-path.tsx
"use client"

import { Card, CardContent } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { Progress } from "@/shared/components/ui/progress"
import { 
  CheckCircle, 
  Circle,
  Lock,
  Play,
  Star
} from "lucide-react"
import { LearningModule } from "../types/learning-path"

interface VisualLearningPathProps {
  modules: LearningModule[]
  categoryColor: string
}

export function VisualLearningPath({ modules, categoryColor }: VisualLearningPathProps) {
  const sortedModules = modules.sort((a, b) => a.order - b.order)

  const ModuleNode = ({ module, index }: { module: LearningModule; index: number }) => {
    const isCompleted = module.status === 'completed'
    const isInProgress = module.status === 'in_progress'
    const isAvailable = module.status === 'available'
    const isLocked = module.status === 'locked'

    return (
      <div className="relative">
        {/* Connection line to next module */}
        {index < sortedModules.length - 1 && (
          <div className="absolute left-1/2 top-full w-0.5 h-16 bg-gray-200 transform -translate-x-1/2 z-0" />
        )}
        
        {/* Module Card */}
        <Card className={`
          relative z-10 w-80 mx-auto transition-all duration-200 hover:shadow-lg cursor-pointer
          ${isCompleted ? 'border-green-200 bg-green-50/50' : ''}
          ${isInProgress ? 'border-blue-200 bg-blue-50/50' : ''}
          ${isLocked ? 'opacity-60' : ''}
        `}>
          <CardContent className="p-6">
            {/* Status Icon */}
            <div className="flex justify-center mb-4">
              <div className={`
                w-12 h-12 rounded-full flex items-center justify-center
                ${isCompleted ? 'bg-green-500' : ''}
                ${isInProgress ? 'bg-blue-500' : ''}
                ${isAvailable ? 'bg-gray-400' : ''}
                ${isLocked ? 'bg-gray-300' : ''}
              `}>
                {isCompleted && <CheckCircle className="h-6 w-6 text-white" />}
                {isInProgress && <Circle className="h-6 w-6 text-white" />}
                {isAvailable && <Circle className="h-6 w-6 text-white" />}
                {isLocked && <Lock className="h-6 w-6 text-white" />}
              </div>
            </div>

            {/* Module Info */}
            <div className="text-center space-y-3">
              <div>
                <h3 className={`font-semibold text-lg mb-1 ${isLocked ? 'text-gray-600' : ''}`}>
                  {module.name}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {module.description}
                </p>
              </div>

              {/* Stats */}
              <div className="flex justify-center gap-4 text-sm text-muted-foreground">
                <span>{module.questionCount} questions</span>
                <span>•</span>
                <span>{module.estimatedHours}h</span>
              </div>

              {/* Score for completed modules */}
              {isCompleted && module.score && (
                <div className="flex items-center justify-center gap-1">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-green-600">{module.score}%</span>
                </div>
              )}

              {/* Progress for in-progress modules */}
              {isInProgress && module.progress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress</span>
                    <span>{Math.round(module.progress)}%</span>
                  </div>
                  <Progress value={module.progress} className="w-full" />
                </div>
              )}

              {/* Status Badge */}
              <div className="flex justify-center">
                {isCompleted && <Badge className="bg-green-100 text-green-800">Completed</Badge>}
                {isInProgress && <Badge variant="secondary">In Progress</Badge>}
                {isAvailable && <Badge variant="outline">Available</Badge>}
                {isLocked && <Badge variant="outline">Locked</Badge>}
              </div>

              {/* Action Button */}
              <div className="pt-2">
                {isCompleted && (
                  <Button variant="outline" size="sm" className="w-full">
                    Review
                  </Button>
                )}
                {isInProgress && (
                  <Button size="sm" className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Continue
                  </Button>
                )}
                {isAvailable && (
                  <Button size="sm" className="w-full">
                    Start Module
                  </Button>
                )}
                {isLocked && (
                  <Button variant="outline" size="sm" disabled className="w-full">
                    <Lock className="h-4 w-4 mr-2" />
                    Locked
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="py-8">
      <div className="space-y-16">
        {sortedModules.map((module, index) => (
          <ModuleNode key={module.id} module={module} index={index} />
        ))}
      </div>
    </div>
  )
}
