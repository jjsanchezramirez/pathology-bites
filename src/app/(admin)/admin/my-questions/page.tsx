import { Metadata } from 'next'
import { MyWorkflowClient } from './my-workflow-client'

export const metadata: Metadata = {
  title: 'My Workflow | Pathology Bites Admin',
  description: 'Manage questions that need your attention',
}

export default function MyQuestionsPage() {
  return <MyWorkflowClient />
}
