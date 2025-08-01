'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Trash2, Plus, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'

interface DemoQuestion {
  id: string
  question_id: string
  is_active: boolean
  display_order: number
  questions: {
    id: string
    title: string
    status: string
  }
}

export function DemoQuestionManager() {
  const [demoQuestions, setDemoQuestions] = useState<DemoQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [newQuestionId, setNewQuestionId] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchDemoQuestions = async () => {
    try {
      const response = await fetch('/api/admin/demo-questions')
      if (response.ok) {
        const data = await response.json()
        setDemoQuestions(data)
      } else {
        toast.error('Failed to fetch demo questions')
      }
    } catch (error) {
      console.error('Error fetching demo questions:', error)
      toast.error('Error fetching demo questions')
    } finally {
      setLoading(false)
    }
  }

  const addDemoQuestion = async () => {
    if (!newQuestionId.trim()) {
      toast.error('Please enter a question ID')
      return
    }

    setAdding(true)
    try {
      const response = await fetch('/api/admin/demo-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question_id: newQuestionId.trim()
        })
      })

      if (response.ok) {
        const newDemo = await response.json()
        setDemoQuestions(prev => [...prev, newDemo].sort((a, b) => a.display_order - b.display_order))
        setNewQuestionId('')
        toast.success('Demo question added successfully')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to add demo question')
      }
    } catch (error) {
      console.error('Error adding demo question:', error)
      toast.error('Error adding demo question')
    } finally {
      setAdding(false)
    }
  }

  const removeDemoQuestion = async (id: string, title: string) => {
    if (!confirm(`Remove "${title}" from demo rotation?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/demo-questions?id=${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setDemoQuestions(prev => prev.filter(q => q.id !== id))
        toast.success('Demo question removed')
      } else {
        toast.error('Failed to remove demo question')
      }
    } catch (error) {
      console.error('Error removing demo question:', error)
      toast.error('Error removing demo question')
    }
  }

  const toggleActive = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch('/api/admin/demo-questions', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id,
          is_active: !currentActive
        })
      })

      if (response.ok) {
        const updated = await response.json()
        setDemoQuestions(prev => 
          prev.map(q => q.id === id ? updated : q)
        )
        toast.success(`Demo question ${!currentActive ? 'activated' : 'deactivated'}`)
      } else {
        toast.error('Failed to update demo question')
      }
    } catch (error) {
      console.error('Error updating demo question:', error)
      toast.error('Error updating demo question')
    }
  }

  useEffect(() => {
    fetchDemoQuestions()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Demo Question Manager</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Demo Question Manager
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDemoQuestions}
            className="flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add new demo question */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter question ID to add to demo rotation"
            value={newQuestionId}
            onChange={(e) => setNewQuestionId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addDemoQuestion()}
          />
          <Button 
            onClick={addDemoQuestion}
            disabled={adding || !newQuestionId.trim()}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {adding ? 'Adding...' : 'Add'}
          </Button>
        </div>

        {/* Current demo questions */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            Current Demo Questions ({demoQuestions.length})
          </h3>
          
          {demoQuestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No demo questions configured
            </div>
          ) : (
            <div className="space-y-2">
              {demoQuestions.map((demo) => (
                <div
                  key={demo.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        #{demo.display_order}
                      </Badge>
                      <span className="font-medium">
                        {demo.questions.title}
                      </span>
                      <Badge 
                        variant={demo.is_active ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {demo.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      ID: {demo.question_id}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleActive(demo.id, demo.is_active)}
                    >
                      {demo.is_active ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeDemoQuestion(demo.id, demo.questions.title)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
          <strong>Instructions:</strong>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li>Enter a question ID to add it to the demo rotation</li>
            <li>Questions must be published to be added</li>
            <li>Display order is automatically assigned</li>
            <li>Demo questions cycle in sequential order</li>
            <li>Deactivated questions are skipped in rotation</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
