import { Metadata } from 'next'
import { CreateQuestionV2Client } from './create-question-v2-client'

export const metadata: Metadata = {
  title: 'Create Question - Admin',
  description: 'AI-powered question creation for medical education',
}

export default function CreateQuestionV2Page() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Create Question</h1>
        <p className="text-muted-foreground mt-2">
          Generate high-quality medical questions using AI with educational content context
        </p>
      </div>
      
      <CreateQuestionV2Client />
    </div>
  )
}
