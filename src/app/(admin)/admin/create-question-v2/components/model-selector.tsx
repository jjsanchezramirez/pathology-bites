'use client'

import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { Label } from '@/shared/components/ui/label'
import { Zap, Clock, Brain, Star, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface ModelSelectorProps {
  selectedModel: string
  onModelSelected: (model: string) => void
}

interface AIModel {
  id: string
  name: string
  provider: 'gemini' | 'mistral' | 'llama' | 'groq' | 'claude' | 'chatgpt'
  category: 'recommended' | 'fast' | 'advanced'
  description: string
  speed: 'fast' | 'medium' | 'slow'
  quality: 'high' | 'very-high' | 'excellent'
  contextLength: string
  strengths: string[]
  available: boolean
}

const AI_MODELS: AIModel[] = [
  // Recommended models
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'gemini',
    category: 'recommended',
    description: 'Fast and reliable with excellent JSON generation. Best for most use cases.',
    speed: 'fast',
    quality: 'high',
    contextLength: '1M tokens',
    strengths: ['Structured output', 'Medical knowledge', 'Fast response'],
    available: true
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'gemini',
    category: 'recommended',
    description: 'Most capable Gemini model with superior reasoning and medical knowledge.',
    speed: 'medium',
    quality: 'excellent',
    contextLength: '2M tokens',
    strengths: ['Advanced reasoning', 'Complex scenarios', 'High accuracy'],
    available: true
  },
  {
    id: 'mistral-medium-2505',
    name: 'Mistral Medium',
    provider: 'mistral',
    category: 'recommended',
    description: 'Balanced performance with good medical knowledge and structured output.',
    speed: 'fast',
    quality: 'high',
    contextLength: '32K tokens',
    strengths: ['Medical expertise', 'Structured output', 'Reliable'],
    available: true
  },
  
  // Fast models
  {
    id: 'ministral-8b-2410',
    name: 'Ministral 8B',
    provider: 'mistral',
    category: 'fast',
    description: 'Lightweight and fast model for quick question generation.',
    speed: 'fast',
    quality: 'high',
    contextLength: '128K tokens',
    strengths: ['Speed', 'Efficiency', 'Good quality'],
    available: true
  },
  {
    id: 'llama-3.1-8b-instant',
    name: 'Llama 3.1 8B Instant',
    provider: 'groq',
    category: 'fast',
    description: 'Ultra-fast Llama model via Groq infrastructure.',
    speed: 'fast',
    quality: 'high',
    contextLength: '128K tokens',
    strengths: ['Ultra-fast', 'Good quality', 'Reliable'],
    available: true
  },
  
  // Advanced models
  {
    id: 'Llama-3.3-8B-Instruct',
    name: 'Llama 3.3 8B',
    provider: 'llama',
    category: 'advanced',
    description: 'Latest Llama model with structured output support.',
    speed: 'medium',
    quality: 'very-high',
    contextLength: '128K tokens',
    strengths: ['Latest features', 'Structured output', 'Medical knowledge'],
    available: true
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'Claude 3.5 Haiku',
    provider: 'claude',
    category: 'advanced',
    description: 'Fast Claude model with excellent reasoning capabilities.',
    speed: 'fast',
    quality: 'very-high',
    contextLength: '200K tokens',
    strengths: ['Reasoning', 'Medical knowledge', 'Structured thinking'],
    available: true
  }
]

const categoryIcons = {
  recommended: <Star className="h-4 w-4" />,
  fast: <Zap className="h-4 w-4" />,
  advanced: <Brain className="h-4 w-4" />
}

const categoryColors = {
  recommended: 'bg-green-100 text-green-800 border-green-200',
  fast: 'bg-blue-100 text-blue-800 border-blue-200',
  advanced: 'bg-purple-100 text-purple-800 border-purple-200'
}

const speedColors = {
  fast: 'text-green-600',
  medium: 'text-yellow-600',
  slow: 'text-red-600'
}

const qualityColors = {
  high: 'text-blue-600',
  'very-high': 'text-purple-600',
  excellent: 'text-green-600'
}

export function ModelSelector({ selectedModel, onModelSelected }: ModelSelectorProps) {
  const [tempSelectedModel, setTempSelectedModel] = useState(selectedModel)

  const handleConfirmSelection = () => {
    if (!tempSelectedModel) {
      toast.error('Please select a model')
      return
    }

    const model = AI_MODELS.find(m => m.id === tempSelectedModel)
    onModelSelected(tempSelectedModel)
    toast.success(`Selected ${model?.name} for question generation`)
  }

  const groupedModels = AI_MODELS.reduce((acc, model) => {
    if (!acc[model.category]) {
      acc[model.category] = []
    }
    acc[model.category].push(model)
    return acc
  }, {} as Record<string, AIModel[]>)

  return (
    <div className="space-y-6">
      {selectedModel && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-800 flex items-center gap-2">
              <CheckCircle className="h-5 w-5" />
              Selected Model
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const model = AI_MODELS.find(m => m.id === selectedModel)
              return model ? (
                <div className="flex items-center gap-3">
                  <Badge className={categoryColors[model.category]}>
                    {categoryIcons[model.category]}
                    <span className="ml-1 capitalize">{model.category}</span>
                  </Badge>
                  <span className="font-medium">{model.name}</span>
                  <Badge variant="outline">{model.provider}</Badge>
                </div>
              ) : null
            })()}
          </CardContent>
        </Card>
      )}

      <RadioGroup value={tempSelectedModel} onValueChange={setTempSelectedModel}>
        {Object.entries(groupedModels).map(([category, models]) => (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2 mb-3">
              {categoryIcons[category as keyof typeof categoryIcons]}
              <h3 className="text-lg font-semibold capitalize">{category} Models</h3>
            </div>
            
            <div className="grid gap-3">
              {models.map((model) => (
                <Card 
                  key={model.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    tempSelectedModel === model.id ? 'ring-2 ring-primary' : ''
                  } ${!model.available ? 'opacity-50' : ''}`}
                  onClick={() => model.available && setTempSelectedModel(model.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <RadioGroupItem 
                        value={model.id} 
                        id={model.id}
                        disabled={!model.available}
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Label htmlFor={model.id} className="font-medium cursor-pointer">
                            {model.name}
                          </Label>
                          <Badge className={categoryColors[model.category]} variant="outline">
                            {categoryIcons[model.category]}
                            <span className="ml-1 capitalize">{model.category}</span>
                          </Badge>
                          <Badge variant="outline">{model.provider}</Badge>
                          {!model.available && <Badge variant="destructive">Unavailable</Badge>}
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {model.description}
                        </p>
                        
                        <div className="flex items-center gap-4 text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span className={speedColors[model.speed]}>
                              {model.speed}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            <span className={qualityColors[model.quality]}>
                              {model.quality}
                            </span>
                          </div>
                          <span className="text-muted-foreground">
                            {model.contextLength}
                          </span>
                        </div>
                        
                        <div className="flex flex-wrap gap-1">
                          {model.strengths.map((strength) => (
                            <Badge key={strength} variant="secondary" className="text-xs">
                              {strength}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </RadioGroup>

      <div className="flex justify-end">
        <Button 
          onClick={handleConfirmSelection}
          disabled={!tempSelectedModel}
          className="min-w-[120px]"
        >
          Select Model
        </Button>
      </div>
    </div>
  )
}
