'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { FileText, Brain, Upload } from 'lucide-react'

// Import existing components
import { CreateQuestionClient } from './create-question-client'
import { EnhancedImportDialog } from '@/features/questions/components/enhanced-import-dialog'
import { QuestionForm } from '@/features/questions/components/question-form'
import { Button } from '@/shared/components/ui/button'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

// Manual creation form data type
type QuestionFormData = {
  body: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  yield: 'low' | 'medium' | 'high';
  categories: string[];
  reference_text?: string;
};

export function UnifiedCreateQuestionClient() {
  const [activeTab, setActiveTab] = useState('manual')
  const [showImportDialog, setShowImportDialog] = useState(false)
  const router = useRouter()

  // Handle manual form submission
  const handleManualSubmit = async (data: QuestionFormData) => {
    try {
      const response = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to create question');
      }

      toast.success('Question created successfully!');
      router.push('/admin/questions');
      router.refresh();
    } catch (error) {
      console.error('Error creating question:', error);
      toast.error('Failed to create question');
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Manual Creation
          </TabsTrigger>
          <TabsTrigger value="ai" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI-Assisted
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            JSON Import
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Manual Question Creation
              </CardTitle>
              <CardDescription>
                Create questions manually using a structured form. Perfect for when you have specific content in mind.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-w-2xl">
                <QuestionForm
                  onSubmit={handleManualSubmit}
                  isEdit={false}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                AI-Assisted Question Generation
              </CardTitle>
              <CardDescription>
                Generate high-quality questions using AI with pathology educational content as context.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Use the existing AI creation workflow */}
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">AI-assisted creation includes:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Educational content selection from PathPrimer database</li>
                    <li>AI-powered question generation with multiple models</li>
                    <li>Interactive preview and editing capabilities</li>
                    <li>Image attachment support</li>
                    <li>Automated categorization and tagging</li>
                  </ul>
                </div>
                <CreateQuestionClient />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                JSON Import
              </CardTitle>
              <CardDescription>
                Import multiple questions at once from a JSON file. Ideal for bulk operations and migrating existing content.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="mb-2">JSON import allows you to:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Import multiple questions simultaneously</li>
                    <li>Migrate content from other systems</li>
                    <li>Bulk create questions with consistent formatting</li>
                    <li>Include images, tags, and categories</li>
                  </ul>
                </div>
                
                <Button 
                  onClick={() => setShowImportDialog(true)}
                  className="w-full"
                  size="lg"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Start JSON Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* JSON Import Dialog */}
      <EnhancedImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSave={() => {
          setShowImportDialog(false);
          toast.success('Questions imported successfully!');
          router.push('/admin/questions');
          router.refresh();
        }}
      />
    </div>
  )
}
