// src/features/achievements/components/achievement-card.tsx

import { Card, CardContent } from '@/shared/components/ui/card'
import { Progress } from '@/shared/components/ui/progress'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/shared/utils'

interface AchievementCardProps {
  icon: LucideIcon
  title: string
  description: string
  isUnlocked: boolean
  progress?: number
  maxProgress?: number
  iconColor?: string
}

export function AchievementCard({
  icon: Icon,
  title,
  description,
  isUnlocked,
  progress = 0,
  maxProgress = 100,
  iconColor = 'text-primary'
}: AchievementCardProps) {
  const progressPercentage = maxProgress > 0 ? (progress / maxProgress) * 100 : 0

  return (
    <Card className="text-center">
      <CardContent className="pt-6 pb-4 px-4">
        {/* Badge Icon */}
        <div className="mb-4 flex justify-center">
          <div className={cn(
            "rounded-full p-6 transition-all",
            isUnlocked
              ? "bg-primary/10"
              : "bg-muted grayscale opacity-60"
          )}>
            <Icon className={cn(
              "h-12 w-12",
              isUnlocked ? iconColor : "text-muted-foreground"
            )} />
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold mb-2">{title}</h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">
          {description}
        </p>

        {/* Progress */}
        <div className="space-y-2">
          <Progress
            value={progressPercentage}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground">
            {progress}/{maxProgress}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

