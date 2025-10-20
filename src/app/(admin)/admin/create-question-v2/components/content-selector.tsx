'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Loader2, BookOpen, GraduationCap, FileText, Target } from 'lucide-react'
import { toast } from 'sonner'
import { EducationalContent } from '../create-question-v2-client'

interface ContentSelectorProps {
  selectedContent: EducationalContent | null
  onContentSelected: (content: EducationalContent) => void
}

interface PathPrimerData {
  [category: string]: {
    [subject: string]: {
      [lesson: string]: {
        [topic: string]: any
      }
    }
  }
}

export function ContentSelector({ selectedContent, onContentSelected }: ContentSelectorProps) {
  const [pathPrimerData, setPathPrimerData] = useState<PathPrimerData>({})
  const [isLoading, setIsLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedLesson, setSelectedLesson] = useState('')
  const [selectedTopic, setSelectedTopic] = useState('')

  useEffect(() => {
    loadPathPrimerData()
  }, [])

  const loadPathPrimerData = async () => {
    try {
      setIsLoading(true)
      
      // For now, use mock data structure - replace with actual PathPrimer API
      const mockData = {
        'Pathology': {
          'General Pathology': {
            'Cell Injury and Death': {
              'Apoptosis': {
                title: 'Apoptosis - Programmed Cell Death',
                description: 'Apoptosis is a form of programmed cell death that occurs in multicellular organisms. It is characterized by specific morphological changes including cell shrinkage, chromatin condensation, and formation of apoptotic bodies.',
                keyPoints: [
                  'Energy-dependent process',
                  'Cell shrinkage and chromatin condensation',
                  'Formation of apoptotic bodies',
                  'No inflammatory response',
                  'Regulated by caspases'
                ]
              },
              'Necrosis': {
                title: 'Necrosis - Cell Death',
                description: 'Necrosis is a form of cell death characterized by cellular swelling, membrane disruption, and inflammatory response.',
                keyPoints: [
                  'Energy-independent process',
                  'Cellular swelling',
                  'Membrane disruption',
                  'Inflammatory response',
                  'Uncontrolled process'
                ]
              }
            },
            'Inflammation': {
              'Acute Inflammation': {
                title: 'Acute Inflammation',
                description: 'Acute inflammation is the immediate response to tissue injury characterized by vascular changes and cellular infiltration.',
                keyPoints: [
                  'Vasodilation',
                  'Increased vascular permeability',
                  'Neutrophil infiltration',
                  'Cardinal signs of inflammation'
                ]
              }
            }
          },
          'Systemic Pathology': {
            'Cardiovascular': {
              'Atherosclerosis': {
                title: 'Atherosclerosis',
                description: 'Atherosclerosis is a disease of large and medium-sized arteries characterized by the formation of atherosclerotic plaques.',
                keyPoints: [
                  'Endothelial dysfunction',
                  'Lipid accumulation',
                  'Inflammatory response',
                  'Plaque formation'
                ]
              }
            }
          }
        }
      }
      setPathPrimerData(mockData)
    } catch (error) {
      console.error('Error loading PathPrimer data:', error)
      toast.error('Failed to load educational content')
    } finally {
      setIsLoading(false)
    }
  }

  const categories = Object.keys(pathPrimerData)
  const subjects = selectedCategory ? Object.keys(pathPrimerData[selectedCategory] || {}) : []
  const lessons = selectedCategory && selectedSubject 
    ? Object.keys(pathPrimerData[selectedCategory]?.[selectedSubject] || {}) 
    : []
  const topics = selectedCategory && selectedSubject && selectedLesson
    ? Object.keys(pathPrimerData[selectedCategory]?.[selectedSubject]?.[selectedLesson] || {})
    : []

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    setSelectedSubject('')
    setSelectedLesson('')
    setSelectedTopic('')
  }

  const handleSubjectChange = (subject: string) => {
    setSelectedSubject(subject)
    setSelectedLesson('')
    setSelectedTopic('')
  }

  const handleLessonChange = (lesson: string) => {
    setSelectedLesson(lesson)
    setSelectedTopic('')
  }

  const handleTopicChange = (topic: string) => {
    setSelectedTopic(topic)
  }

  const handleSelectContent = async () => {
    if (!selectedCategory || !selectedSubject || !selectedLesson || !selectedTopic) {
      toast.error('Please select all content levels')
      return
    }

    try {
      // Load the specific topic content
      const topicContent = pathPrimerData[selectedCategory][selectedSubject][selectedLesson][selectedTopic]
      
      const content: EducationalContent = {
        category: selectedCategory,
        subject: selectedSubject,
        lesson: selectedLesson,
        topic: selectedTopic,
        content: topicContent
      }

      onContentSelected(content)
      toast.success('Educational content selected successfully')
    } catch (error) {
      console.error('Error selecting content:', error)
      toast.error('Failed to select educational content')
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading educational content...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {selectedContent && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-green-800 flex items-center gap-2">
              <Target className="h-5 w-5" />
              Selected Content
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="bg-white">
                <BookOpen className="h-3 w-3 mr-1" />
                {selectedContent.category}
              </Badge>
              <Badge variant="outline" className="bg-white">
                <GraduationCap className="h-3 w-3 mr-1" />
                {selectedContent.subject}
              </Badge>
              <Badge variant="outline" className="bg-white">
                <FileText className="h-3 w-3 mr-1" />
                {selectedContent.lesson}
              </Badge>
              <Badge variant="outline" className="bg-white">
                <Target className="h-3 w-3 mr-1" />
                {selectedContent.topic}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Subject</label>
          <Select value={selectedSubject} onValueChange={handleSubjectChange} disabled={!selectedCategory}>
            <SelectTrigger>
              <SelectValue placeholder="Select subject" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subject) => (
                <SelectItem key={subject} value={subject}>
                  {subject}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Lesson</label>
          <Select value={selectedLesson} onValueChange={handleLessonChange} disabled={!selectedSubject}>
            <SelectTrigger>
              <SelectValue placeholder="Select lesson" />
            </SelectTrigger>
            <SelectContent>
              {lessons.map((lesson) => (
                <SelectItem key={lesson} value={lesson}>
                  {lesson}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Topic</label>
          <Select value={selectedTopic} onValueChange={handleTopicChange} disabled={!selectedLesson}>
            <SelectTrigger>
              <SelectValue placeholder="Select topic" />
            </SelectTrigger>
            <SelectContent>
              {topics.map((topic) => (
                <SelectItem key={topic} value={topic}>
                  {topic}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={handleSelectContent}
          disabled={!selectedCategory || !selectedSubject || !selectedLesson || !selectedTopic}
          className="min-w-[120px]"
        >
          Select Content
        </Button>
      </div>
    </div>
  )
}
