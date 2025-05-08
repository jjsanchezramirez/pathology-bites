// src/components/landing/demo-question-error.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DemoQuestionErrorProps {
  message: string
  onRetry: () => void
}

export default function DemoQuestionError({ message, onRetry }: DemoQuestionErrorProps) {
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="py-2">
        <CardTitle className="text-lg text-red-500 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>Unable to Load Question</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          {message || "We encountered an issue loading the demo question. Please try again later."}
        </div>
        
        <div className="flex justify-end">
          <Button 
            onClick={onRetry}
            variant="default"
            size="sm"
          >
            Try Again
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}