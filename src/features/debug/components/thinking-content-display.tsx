import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Button } from '@/shared/components/ui/button'
import { Badge } from '@/shared/components/ui/badge'
import { ChevronDown, ChevronUp, Brain, Copy } from 'lucide-react'

interface ThinkingContentDisplayProps {
  thinkingContent?: string
  modelName: string
  onCopy?: (text: string) => void
}

export function ThinkingContentDisplay({ 
  thinkingContent, 
  modelName, 
  onCopy 
}: ThinkingContentDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!thinkingContent || thinkingContent.trim() === '') {
    return null
  }

  const handleCopy = () => {
    if (onCopy && thinkingContent) {
      onCopy(thinkingContent)
    }
  }

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <Brain className="h-4 w-4 text-blue-600" />
            <span className="text-blue-800">Thinking Process</span>
            <Badge variant="outline" className="text-xs">
              {modelName}
            </Badge>
          </div>
          <div className="flex items-center space-x-2">
            {onCopy && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-6 px-2"
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 px-2"
            >
              {isExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="bg-white border border-blue-200 rounded p-3 max-h-64 overflow-y-auto">
            <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono">
              {thinkingContent}
            </pre>
          </div>
          <div className="mt-2 text-xs text-blue-600">
            This thinking process was separated from the final response to improve clarity.
          </div>
        </CardContent>
      )}
    </Card>
  )
}
