// src/features/learning-modules/components/quiz-integration.tsx

'use client'

import React, { useState, useEffect } from 'react'
import { Search, Plus, Link, ExternalLink, Play, BarChart3 } from 'lucide-react'
import { LearningModuleIntegrationService } from '../services/integration-service'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Badge } from '@/shared/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Alert, AlertDescription } from '@/shared/components/ui/alert'

interface QuizSession {
  id: string
  title: string
  config: any
  status: string
  created_at: string
  total_questions: number
}

interface QuizIntegrationProps {
  moduleId?: string
  currentQuizId?: string
  onQuizLinked?: (quizId: string) => void
  className?: string
}

export function QuizIntegration({
  moduleId,
  currentQuizId,
  onQuizLinked,
  className = ''
}: QuizIntegrationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [quizSessions, setQuizSessions] = useState<QuizSession[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState<QuizSession | null>(null)
  const [createMode, setCreateMode] = useState(false)
  const [newQuizData, setNewQuizData] = useState({
    title: '',
    description: '',
    questionCount: 10,
    timeLimit: 30,
    showExplanations: true,
    allowReview: true
  })

  const integrationService = new LearningModuleIntegrationService()

  const loadQuizSessions = async () => {
    try {
      setLoading(true)
      const sessions = await integrationService.getQuizSessions({
        search: searchTerm || undefined,
        limit: 20
      })
      setQuizSessions(sessions)
    } catch (error) {
      console.error('Error loading quiz sessions:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadQuizSessions()
    }
  }, [isOpen, searchTerm])

  const handleLinkQuiz = async (quizId: string) => {
    if (!moduleId) return

    try {
      await integrationService.linkQuizToModule(moduleId, quizId)
      onQuizLinked?.(quizId)
      setIsOpen(false)
    } catch (error) {
      console.error('Error linking quiz:', error)
      alert('Failed to link quiz to module')
    }
  }

  const handleCreateQuiz = async () => {
    if (!moduleId) return

    try {
      const quizSession = await integrationService.createModuleQuiz(moduleId, {
        title: newQuizData.title,
        questions: [], // Would be populated with actual questions
        config: {
          timeLimit: newQuizData.timeLimit,
          showExplanations: newQuizData.showExplanations,
          allowReview: newQuizData.allowReview
        }
      })

      onQuizLinked?.(quizSession.id)
      setIsOpen(false)
      setCreateMode(false)
      setNewQuizData({
        title: '',
        description: '',
        questionCount: 10,
        timeLimit: 30,
        showExplanations: true,
        allowReview: true
      })
    } catch (error) {
      console.error('Error creating quiz:', error)
      alert('Failed to create quiz')
    }
  }

  const getCurrentQuizInfo = () => {
    if (!currentQuizId) return null
    return quizSessions.find(q => q.id === currentQuizId)
  }

  const currentQuiz = getCurrentQuizInfo()

  return (
    <div className={className}>
      <div className="space-y-4">
        {/* Current Quiz Display */}
        {currentQuiz ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Linked Quiz</CardTitle>
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  <Link className="h-3 w-3 mr-1" />
                  Linked
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-gray-900">{currentQuiz.title}</h4>
                  <p className="text-sm text-gray-600">
                    {currentQuiz.total_questions} questions • {currentQuiz.config?.timeLimit || 'No time limit'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/quiz/${currentQuiz.id}`} target="_blank" rel="noopener noreferrer">
                      <Play className="h-3 w-3 mr-1" />
                      Preview Quiz
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/admin/quiz/${currentQuiz.id}/analytics`} target="_blank" rel="noopener noreferrer">
                      <BarChart3 className="h-3 w-3 mr-1" />
                      Analytics
                    </a>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setIsOpen(true)}>
                    Change Quiz
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Alert>
            <AlertDescription>
              No quiz is currently linked to this module. Link an existing quiz or create a new one.
            </AlertDescription>
          </Alert>
        )}

        {/* Link/Create Quiz Button */}
        {!currentQuiz && (
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Link or Create Quiz
              </Button>
            </DialogTrigger>
            
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
              <DialogHeader>
                <DialogTitle>Quiz Integration</DialogTitle>
              </DialogHeader>

              <Tabs value={createMode ? 'create' : 'link'} onValueChange={(value) => setCreateMode(value === 'create')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="link">Link Existing Quiz</TabsTrigger>
                  <TabsTrigger value="create">Create New Quiz</TabsTrigger>
                </TabsList>

                <TabsContent value="link" className="space-y-4">
                  {/* Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search quiz sessions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {/* Quiz List */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {loading ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                        <p className="text-gray-600 mt-2 text-sm">Loading quizzes...</p>
                      </div>
                    ) : quizSessions.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No quiz sessions found
                      </div>
                    ) : (
                      quizSessions.map((quiz) => (
                        <Card 
                          key={quiz.id} 
                          className={`cursor-pointer transition-colors hover:bg-gray-50 ${
                            selectedQuiz?.id === quiz.id ? 'ring-2 ring-blue-500' : ''
                          }`}
                          onClick={() => setSelectedQuiz(quiz)}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <h4 className="font-medium text-gray-900 text-sm">{quiz.title}</h4>
                                <p className="text-xs text-gray-600">
                                  {quiz.total_questions} questions • Created {new Date(quiz.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className={
                                  quiz.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                                }>
                                  {quiz.status}
                                </Badge>
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleLinkQuiz(quiz.id)
                                  }}
                                  disabled={!selectedQuiz || selectedQuiz.id !== quiz.id}
                                >
                                  Link
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="create" className="space-y-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="quiz-title">Quiz Title *</Label>
                      <Input
                        id="quiz-title"
                        value={newQuizData.title}
                        onChange={(e) => setNewQuizData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Enter quiz title..."
                      />
                    </div>

                    <div>
                      <Label htmlFor="quiz-description">Description</Label>
                      <Textarea
                        id="quiz-description"
                        value={newQuizData.description}
                        onChange={(e) => setNewQuizData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Brief description of the quiz..."
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="question-count">Question Count</Label>
                        <Input
                          id="question-count"
                          type="number"
                          min="1"
                          max="50"
                          value={newQuizData.questionCount}
                          onChange={(e) => setNewQuizData(prev => ({ ...prev, questionCount: parseInt(e.target.value) || 10 }))}
                        />
                      </div>

                      <div>
                        <Label htmlFor="time-limit">Time Limit (minutes)</Label>
                        <Input
                          id="time-limit"
                          type="number"
                          min="5"
                          max="120"
                          value={newQuizData.timeLimit}
                          onChange={(e) => setNewQuizData(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || 30 }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="show-explanations"
                          checked={newQuizData.showExplanations}
                          onChange={(e) => setNewQuizData(prev => ({ ...prev, showExplanations: e.target.checked }))}
                          className="rounded"
                        />
                        <Label htmlFor="show-explanations" className="text-sm">
                          Show explanations after each question
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="allow-review"
                          checked={newQuizData.allowReview}
                          onChange={(e) => setNewQuizData(prev => ({ ...prev, allowReview: e.target.checked }))}
                          className="rounded"
                        />
                        <Label htmlFor="allow-review" className="text-sm">
                          Allow review of answers
                        </Label>
                      </div>
                    </div>

                    <Alert>
                      <AlertDescription className="text-xs">
                        After creating the quiz, you'll need to add questions through the quiz management interface.
                      </AlertDescription>
                    </Alert>

                    <Button 
                      onClick={handleCreateQuiz}
                      disabled={!newQuizData.title.trim()}
                      className="w-full"
                    >
                      Create Quiz
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
