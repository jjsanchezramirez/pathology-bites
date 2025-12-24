'use client'

import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Slider } from '@/shared/components/ui/slider'

interface QuestionCountSelectorProps {
  questionCount: number
  availableQuestions: number
  questionCountOptions: number[]
  onChange: (count: number) => void
}

export function QuestionCountSelector({
  questionCount,
  availableQuestions,
  questionCountOptions,
  onChange
}: QuestionCountSelectorProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Number of Questions</Label>
        <p className="text-xs text-muted-foreground">Choose how many questions for your quiz</p>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {questionCountOptions.map((count) => {
          const isSelected = questionCount === count
          const isDisabled = count > availableQuestions

          return (
            <Button
              key={count}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              onClick={() => onChange(count)}
              disabled={isDisabled}
            >
              {count}
            </Button>
          )
        })}
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Custom: {questionCount}</span>
          <span className="text-muted-foreground">Max: {availableQuestions}</span>
        </div>
        <Slider
          value={[questionCount]}
          onValueChange={([value]) => onChange(value)}
          max={Math.min(50, availableQuestions)}
          min={1}
          step={1}
          className="w-full"
        />
      </div>
    </div>
  )
}

