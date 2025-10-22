'use client'

import { Check } from 'lucide-react'

interface Step {
  id: number
  name: string
  description: string
}

interface StepProgressBarProps {
  steps: Step[]
  currentStep: number
  onStepClick?: (stepId: number) => void
  mode?: 'create' | 'edit'
}

export function StepProgressBar({ steps, currentStep, onStepClick, mode = 'create' }: StepProgressBarProps) {
  return (
    <div className="flex justify-center py-8">
      <div className="flex items-center gap-0">
        {steps.map((step, index) => {
          const isCompleted = step.id < currentStep
          const isCurrent = step.id === currentStep
          const isLast = index === steps.length - 1

          return (
            <div key={step.id} className="flex items-center gap-0">
              {/* Circle */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 flex-shrink-0 font-medium ${
                  isCompleted
                    ? 'bg-primary border-primary text-white'
                    : isCurrent
                    ? 'bg-white border-primary text-primary'
                    : 'bg-white border-muted-foreground/30 text-muted-foreground'
                } ${
                  mode === 'edit' && !isCompleted ? 'cursor-pointer hover:scale-110 hover:shadow-lg' : ''
                }`}
                onClick={() => mode === 'edit' && onStepClick?.(step.id)}
              >
                {isCompleted ? (
                  <Check className="h-5 w-5 stroke-[3]" />
                ) : (
                  <span className="text-sm">{step.id}</span>
                )}
              </div>

              {/* Connecting Line - Only if not last step */}
              {!isLast && (
                <div className="relative h-1 w-20">
                  {/* Thin gray line - background */}
                  <div className="absolute inset-0 bg-muted-foreground/20" />
                  {/* Accent color line - animated on top */}
                  <div
                    className="absolute inset-0 bg-primary transition-all duration-700 ease-in-out"
                    style={{
                      width: isCompleted ? '100%' : '0%'
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

