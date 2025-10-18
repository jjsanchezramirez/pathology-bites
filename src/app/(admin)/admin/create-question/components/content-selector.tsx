'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'

import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Loader2, FileText, BookOpen, GraduationCap, Target } from 'lucide-react'
import { toast } from 'sonner'

interface EducationalContent {
  category: string
  subject: string
  lesson: string
  topic: string
  content: any
}

interface ContentSelectorProps {
  onContentSelect: (content: EducationalContent) => void
  selectedContent: EducationalContent | null
}

interface ContentFile {
  filename: string
  category: string
  subject: string
}

interface ContentData {
  category: string
  subject: {
    name: string
    url: string
    lessons: Record<string, {
      name: string
      url: string
      topics: Record<string, {
        name: string
        url: string
        content: any
      }>
    }>
  }
}

export function ContentSelector({ onContentSelect, selectedContent }: ContentSelectorProps) {
  const [availableFiles, setAvailableFiles] = useState<ContentFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [contentData, setContentData] = useState<ContentData | null>(null)
  const [selectedLesson, setSelectedLesson] = useState<string>('')
  const [selectedTopic, setSelectedTopic] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [contentPreview, setContentPreview] = useState<string>('')

  // Parse available educational content files
  useEffect(() => {
    const files: ContentFile[] = [
      // Anatomic Pathology files
      { filename: 'ap-bone.json', category: 'Anatomic Pathology', subject: 'Bone' },
      { filename: 'ap-breast.json', category: 'Anatomic Pathology', subject: 'Breast' },
      { filename: 'ap-cardiovascular-and-thoracic.json', category: 'Anatomic Pathology', subject: 'Cardiovascular and Thoracic' },
      { filename: 'ap-cytopathology.json', category: 'Anatomic Pathology', subject: 'Cytopathology' },
      { filename: 'ap-dermatopathology.json', category: 'Anatomic Pathology', subject: 'Dermatopathology' },
      { filename: 'ap-forensics-and-autopsy.json', category: 'Anatomic Pathology', subject: 'Forensics and Autopsy' },
      { filename: 'ap-gastrointestinal.json', category: 'Anatomic Pathology', subject: 'Gastrointestinal' },
      { filename: 'ap-general-topics.json', category: 'Anatomic Pathology', subject: 'General Topics' },
      { filename: 'ap-genitourinary.json', category: 'Anatomic Pathology', subject: 'Genitourinary' },
      { filename: 'ap-gynecological.json', category: 'Anatomic Pathology', subject: 'Gynecological' },
      { filename: 'ap-head-and-neck---endocrine.json', category: 'Anatomic Pathology', subject: 'Head and Neck / Endocrine' },
      { filename: 'ap-hematopathology.json', category: 'Anatomic Pathology', subject: 'Hematopathology' },
      { filename: 'ap-molecular.json', category: 'Anatomic Pathology', subject: 'Molecular' },
      { filename: 'ap-neuropathology.json', category: 'Anatomic Pathology', subject: 'Neuropathology' },
      { filename: 'ap-pancreas-biliary-liver.json', category: 'Anatomic Pathology', subject: 'Pancreas Biliary Liver' },
      { filename: 'ap-pediatrics.json', category: 'Anatomic Pathology', subject: 'Pediatrics' },
      { filename: 'ap-soft-tissue.json', category: 'Anatomic Pathology', subject: 'Soft Tissue' },
      
      // Clinical Pathology files
      { filename: 'cp-clinical-chemistry.json', category: 'Clinical Pathology', subject: 'Clinical Chemistry' },
      { filename: 'cp-hematology-hemostasis-and-thrombosis.json', category: 'Clinical Pathology', subject: 'Hematology Hemostasis and Thrombosis' },
      { filename: 'cp-hematopathology.json', category: 'Clinical Pathology', subject: 'Hematopathology' },
      { filename: 'cp-immunology.json', category: 'Clinical Pathology', subject: 'Immunology' },
      { filename: 'cp-laboratory-management-and-clinical-laboratory-informatics.json', category: 'Clinical Pathology', subject: 'Laboratory Management and Clinical Laboratory Informatics' },
      { filename: 'cp-medical-microbiology.json', category: 'Clinical Pathology', subject: 'Medical Microbiology' },
      { filename: 'cp-molecular-pathology-and-cytogenetics.json', category: 'Clinical Pathology', subject: 'Molecular Pathology and Cytogenetics' },
      { filename: 'cp-toxicology-body-fluids-and-special-techniques.json', category: 'Clinical Pathology', subject: 'Toxicology Body Fluids and Special Techniques' },
      { filename: 'cp-transfusion-medicine.json', category: 'Clinical Pathology', subject: 'Transfusion Medicine' },
    ]
    setAvailableFiles(files)
  }, [])

  // Load educational content data when file is selected
  useEffect(() => {
    if (selectedFile) {
      const loadContentData = async () => {
        try {
          setLoading(true)

          // Use direct R2 access for better performance and to avoid Vercel API costs
          // This matches the pattern used in client-data-manager.ts and other components
          const response = await fetch(`https://pub-cee35549242c4118a1e03da0d07182d3.r2.dev/context/${selectedFile}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            cache: 'force-cache', // Aggressive browser caching for static educational content
          })

          if (!response.ok) {
            throw new Error(`Failed to load educational content`)
          }

          const data = await response.json()
          setContentData(data)
          setSelectedLesson('')
          setSelectedTopic('')
          setContentPreview('')

        } catch (error) {
          console.error('Error loading educational content data:', error)
          toast.error('Failed to load educational content. Please try again.')
          setContentData(null)
          setSelectedLesson('')
          setSelectedTopic('')
          setContentPreview('')
        } finally {
          setLoading(false)
        }
      }

      loadContentData()

      // Cleanup function to abort request if component unmounts
      return () => {
        // Cleanup if needed
      }
    } else {
      // Reset state when no file is selected
      setContentData(null)
      setSelectedLesson('')
      setSelectedTopic('')
      setContentPreview('')
    }
  }, [selectedFile])

  // Auto-select content when all dropdowns have valid selections
  const handleAutoSelect = useCallback(() => {
    if (contentData && selectedLesson && selectedTopic) {
      const lesson = contentData.subject.lessons[selectedLesson]
      const topic = lesson?.topics[selectedTopic]
      if (topic) {
        const newContent = {
          category: contentData.category,
          subject: contentData.subject.name,
          lesson: selectedLesson,
          topic: selectedTopic,
          content: topic.content
        }

        // Only call if content has actually changed
        if (!selectedContent ||
            selectedContent.category !== newContent.category ||
            selectedContent.subject !== newContent.subject ||
            selectedContent.lesson !== newContent.lesson ||
            selectedContent.topic !== newContent.topic) {
          onContentSelect(newContent)
        }
      }
    }
  }, [contentData, selectedLesson, selectedTopic, selectedContent, onContentSelect])

  // Update content preview and auto-select when topic is selected
  useEffect(() => {
    if (contentData && selectedLesson && selectedTopic) {
      const lesson = contentData.subject.lessons[selectedLesson]
      const topic = lesson?.topics[selectedTopic]
      if (topic?.content) {
        const contentStr = JSON.stringify(topic.content, null, 2)
        setContentPreview(contentStr.substring(0, 2000) + (contentStr.length > 2000 ? '...' : ''))

        // Auto-select content when all dropdowns are filled
        handleAutoSelect()
      }
    }
  }, [contentData, selectedLesson, selectedTopic])

  const groupedFiles = availableFiles.reduce((acc, file) => {
    if (!acc[file.category]) {
      acc[file.category] = []
    }
    acc[file.category].push(file)
    return acc
  }, {} as Record<string, ContentFile[]>)

  return (
    <div className="space-y-6">
      {/* File Selection */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Category & Subject</label>
          <Select value={selectedFile} onValueChange={setSelectedFile}>
            <SelectTrigger>
              <SelectValue placeholder="Select an educational content subject..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(groupedFiles).map(([category, files]) => (
                <div key={category}>
                  <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                    {category}
                  </div>
                  {files.map((file) => (
                    <SelectItem key={file.filename} value={file.filename}>
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4" />
                        {file.subject}
                      </div>
                    </SelectItem>
                  ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>

        {contentData && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Lesson</label>
            <Select value={selectedLesson} onValueChange={setSelectedLesson}>
              <SelectTrigger>
                <SelectValue placeholder="Select a lesson..." />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(contentData.subject.lessons).map(([lessonKey, lesson]) => (
                  <SelectItem key={lessonKey} value={lessonKey}>
                    <div className="flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      {lesson.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Simple Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Loading content...</span>
        </div>
      )}

      {/* Topic Selection */}
      {contentData && selectedLesson && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Topic</label>
          <Select value={selectedTopic} onValueChange={setSelectedTopic}>
            <SelectTrigger>
              <SelectValue placeholder="Select a topic..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(contentData.subject.lessons[selectedLesson].topics).map(([topicKey, topic]) => (
                <SelectItem key={topicKey} value={topicKey}>
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    {topic.name}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Content Preview */}
      {contentPreview && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Content Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-48 w-full rounded border p-4">
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap">
                {contentPreview}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Selected Content Summary */}
      {selectedContent && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="secondary">{selectedContent.category}</Badge>
              <Badge variant="outline">{selectedContent.subject}</Badge>
            </div>
            <p className="text-sm">
              <strong>Lesson:</strong> {selectedContent.lesson}
            </p>
            <p className="text-sm">
              <strong>Topic:</strong> {selectedContent.topic}
            </p>
          </CardContent>
        </Card>
      )}


    </div>
  )
}
