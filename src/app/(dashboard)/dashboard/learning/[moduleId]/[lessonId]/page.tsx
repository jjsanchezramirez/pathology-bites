// src/app/(dashboard)/dashboard/learning/[moduleId]/[lessonId]/page.tsx
"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Button } from "@/shared/components/ui/button"
import { Progress } from "@/shared/components/ui/progress"
import { Badge } from "@/shared/components/ui/badge"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group"
import { Label } from "@/shared/components/ui/label"
import {
  BookOpen,
  CheckCircle,
  Clock,
  Target,
  ChevronLeft,
  ChevronRight,
  ArrowRight,

  FileText,
  Award,
  AlertCircle,
  Lightbulb,
  ImageIcon,
  Brain
} from "lucide-react"
import { getModuleById } from "@/features/learning-path/data/learning-categories"

interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  explanation: string
  imageUrl?: string
}

const mockQuestions: Question[] = [
  {
    id: "q1",
    question: "What is the primary characteristic of osteoblasts in normal bone formation?",
    options: [
      "They resorb bone matrix",
      "They produce osteoid (unmineralized bone matrix)",
      "They remain dormant in lacunae",
      "They form the periosteum"
    ],
    correctAnswer: 1,
    explanation: "Osteoblasts are bone-forming cells that synthesize and secrete osteoid, the unmineralized organic matrix of bone. This osteoid later becomes mineralized with calcium phosphate crystals to form mature bone."
  },
  {
    id: "q2", 
    question: "Which of the following best describes the process of endochondral ossification?",
    options: [
      "Direct formation of bone from mesenchymal tissue",
      "Bone formation through replacement of cartilage template", 
      "Formation of bone only in flat bones of the skull",
      "Mineralization of existing bone tissue"
    ],
    correctAnswer: 1,
    explanation: "Endochondral ossification is the process by which most bones in the body are formed. It involves the replacement of a cartilage template (model) with bone tissue. This process is responsible for the formation of long bones and most other bones in the skeleton.",
    imageUrl: "/api/placeholder/600/400" // This would be replaced with actual R2 URL
  }
]

export default function LessonPage() {
  const params = useParams()
  const router = useRouter()
  const moduleId = params.moduleId as string
  const lessonId = params.lessonId as string

  const [module, setModule] = useState<any>(null)
  const [lesson, setLesson] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<{[key: string]: number}>({})
  const [showResults, setShowResults] = useState(false)
  const [quizCompleted, setQuizCompleted] = useState(false)

  useEffect(() => {
    const fetchLessonData = async () => {
      try {
        setLoading(true)
        
        const moduleData = getModuleById(moduleId)
        if (!moduleData) {
          router.push('/dashboard/learning')
          return
        }
        
        const lessonData = moduleData.modules.find(m => m.id === lessonId)
        if (!lessonData) {
          router.push(`/dashboard/learning/${moduleId}`)
          return
        }
        
        setModule(moduleData)
        setLesson(lessonData)
      } catch (error) {
        console.error('Error fetching lesson:', error)
        router.push('/dashboard/learning')
      } finally {
        setLoading(false)
      }
    }

    if (moduleId && lessonId) {
      fetchLessonData()
    }
  }, [moduleId, lessonId, router])

  const handleAnswerSelect = (questionId: string, answerIndex: number) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answerIndex
    }))
  }

  const checkAnswers = () => {
    setShowResults(true)
    setQuizCompleted(true)
  }

  const getScore = () => {
    let correct = 0
    mockQuestions.forEach(q => {
      if (selectedAnswers[q.id] === q.correctAnswer) {
        correct++
      }
    })
    return Math.round((correct / mockQuestions.length) * 100)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-16" />
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-5 w-96" />
          </div>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-40 w-full" />
              </CardContent>
            </Card>
          </div>
          
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (!lesson || !module) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold mb-4">Lesson not found</h1>
        <Link href="/dashboard/learning">
          <Button>Back to Learning Modules</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb and Header */}
      <div className="flex items-center gap-4">
        <Link href={`/dashboard/learning/${moduleId}`}>
          <Button variant="outline" size="sm">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back to Module
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <span>{module.name}</span>
            <ChevronRight className="h-4 w-4" />
            <span>{lesson.name}</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{lesson.name}</h1>
          <p className="text-muted-foreground mt-1">
            {lesson.description}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center text-sm mb-2">
            <span className="font-medium">Lesson Progress</span>
            <span className="font-medium">{lesson.progress || 0}%</span>
          </div>
          <Progress value={lesson.progress || 0} className="w-full h-2" />
        </CardContent>
      </Card>

      {/* Main Content */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Content Area */}
        <div className="md:col-span-2 space-y-6">
          {/* Learning Content */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                Lesson Content
              </CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              {lessonId === 'bone-development' ? (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-3">Introduction to Bone Development</h3>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      Bone development, also known as osteogenesis or ossification, is a complex process that begins during embryonic development and continues throughout life. Understanding this fundamental process is crucial for pathologists as many bone pathologies are related to disruptions in normal bone formation and remodeling.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3">Types of Ossification</h4>
                    <p className="text-muted-foreground leading-relaxed mb-4">
                      There are two primary mechanisms of bone formation:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li><strong>Intramembranous ossification:</strong> Direct formation of bone from mesenchymal tissue, primarily seen in flat bones of the skull and face.</li>
                      <li><strong>Endochondral ossification:</strong> Formation of bone through replacement of a cartilage template, responsible for most bones in the skeleton.</li>
                    </ul>
                  </div>

                  {/* Sample Image */}
                  <Card className="bg-gray-50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Bone Development Stages
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="relative aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                          <p className="text-sm text-gray-500">High-resolution image of endochondral ossification stages</p>
                          <p className="text-xs text-gray-400 mt-1">(Image would be loaded from R2 storage)</p>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-3">
                        <strong>Figure 1:</strong> Longitudinal section showing the progression of endochondral ossification 
                        from cartilage template to mature bone tissue. Note the distinct zones: resting cartilage, 
                        proliferation, hypertrophy, and ossification.
                      </p>
                    </CardContent>
                  </Card>

                  <div>
                    <h4 className="font-semibold mb-3">Key Cellular Players</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="p-4 bg-green-50 border-green-200">
                        <h5 className="font-semibold text-green-800 mb-2">Osteoblasts</h5>
                        <p className="text-sm text-green-700">
                          Bone-forming cells that synthesize and secrete osteoid (unmineralized bone matrix)
                        </p>
                      </Card>
                      <Card className="p-4 bg-blue-50 border-blue-200">
                        <h5 className="font-semibold text-blue-800 mb-2">Osteoclasts</h5>
                        <p className="text-sm text-blue-700">
                          Large multinucleated cells responsible for bone resorption and remodeling
                        </p>
                      </Card>
                      <Card className="p-4 bg-purple-50 border-purple-200">
                        <h5 className="font-semibold text-purple-800 mb-2">Osteocytes</h5>
                        <p className="text-sm text-purple-700">
                          Mature bone cells embedded in lacunae that maintain bone tissue
                        </p>
                      </Card>
                      <Card className="p-4 bg-orange-50 border-orange-200">
                        <h5 className="font-semibold text-orange-800 mb-2">Chondrocytes</h5>
                        <p className="text-sm text-orange-700">
                          Cartilage cells that form the initial template in endochondral ossification
                        </p>
                      </Card>
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <h5 className="font-semibold text-blue-800 mb-1">Clinical Correlation</h5>
                        <p className="text-sm text-blue-700">
                          Understanding normal bone development is essential for recognizing pathological conditions such as 
                          achondroplasia, osteogenesis imperfecta, and rickets, where these normal processes are disrupted.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    This lesson covers {lesson.name.toLowerCase()} in detail. The content would include comprehensive 
                    text, images, diagrams, and interactive elements to help you master this important topic in pathology.
                  </p>
                  <p className="text-muted-foreground">
                    Key learning objectives for this lesson include understanding the fundamental concepts, 
                    recognizing important microscopic features, and applying knowledge to clinical scenarios.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Practice Questions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                Practice Questions
                {quizCompleted && (
                  <Badge variant="outline" className="ml-2">
                    Score: {getScore()}%
                  </Badge>
                )}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Test your understanding with these practice questions
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {mockQuestions.map((question, index) => (
                <Card key={question.id} className="p-6 border-2">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <span className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <h4 className="font-semibold mb-3">{question.question}</h4>
                        
                        {question.imageUrl && (
                          <div className="mb-4">
                            <div className="relative aspect-video bg-gray-100 rounded-lg flex items-center justify-center max-w-md">
                              <div className="text-center">
                                <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                <p className="text-xs text-gray-500">Question image from R2</p>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <RadioGroup
                          value={selectedAnswers[question.id]?.toString()}
                          onValueChange={(value) => handleAnswerSelect(question.id, parseInt(value))}
                        >
                          {question.options.map((option, optionIndex) => (
                            <div key={optionIndex} className="flex items-center space-x-2">
                              <RadioGroupItem value={optionIndex.toString()} id={`${question.id}-${optionIndex}`} />
                              <Label 
                                htmlFor={`${question.id}-${optionIndex}`}
                                className={`flex-1 cursor-pointer ${
                                  showResults && selectedAnswers[question.id] === optionIndex
                                    ? selectedAnswers[question.id] === question.correctAnswer
                                      ? 'text-green-700 font-medium'
                                      : 'text-red-700 font-medium'
                                    : showResults && optionIndex === question.correctAnswer
                                      ? 'text-green-700 font-medium'
                                      : ''
                                }`}
                              >
                                {option}
                                {showResults && optionIndex === question.correctAnswer && (
                                  <CheckCircle className="h-4 w-4 text-green-500 ml-2 inline" />
                                )}
                                {showResults && selectedAnswers[question.id] === optionIndex && optionIndex !== question.correctAnswer && (
                                  <AlertCircle className="h-4 w-4 text-red-500 ml-2 inline" />
                                )}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                        
                        {showResults && (
                          <div className="mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                            <h5 className="font-semibold text-blue-800 mb-2">Explanation:</h5>
                            <p className="text-sm text-blue-700">{question.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              
              {!showResults && (
                <div className="text-center">
                  <Button 
                    onClick={checkAnswers}
                    disabled={Object.keys(selectedAnswers).length !== mockQuestions.length}
                    className="px-8"
                  >
                    Check Answers
                  </Button>
                </div>
              )}
              
              {showResults && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-6 text-center">
                    <Award className="h-12 w-12 text-green-500 mx-auto mb-3" />
                    <h3 className="text-lg font-semibold text-green-800 mb-2">
                      Quiz Complete!
                    </h3>
                    <p className="text-green-700 mb-4">
                      You scored {getScore()}% ({mockQuestions.filter(q => selectedAnswers[q.id] === q.correctAnswer).length}/{mockQuestions.length} correct)
                    </p>
                    <Button asChild>
                      <Link href={`/dashboard/learning/${moduleId}`}>
                        Complete Lesson
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Lesson Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Lesson Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-500" />
                <span>{lesson.estimatedHours} hours</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Target className="h-4 w-4 text-gray-500" />
                <span>{lesson.questionCount} practice questions</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4 text-gray-500" />
                <span>Interactive content</span>
              </div>
            </CardContent>
          </Card>

          {/* Navigation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Navigation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href={`/dashboard/learning/${moduleId}`}>
                <Button variant="outline" size="sm" className="w-full justify-start">
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Back to Module
                </Button>
              </Link>
              <Button size="sm" className="w-full justify-start" disabled>
                <ChevronRight className="h-4 w-4 mr-2" />
                Next Lesson
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}