'use client';

import { useRouter } from 'next/navigation';
import { QuestionForm } from '@/features/questions/components/question-form';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

// Import the correct type from the QuestionForm component
type QuestionFormData = {
  body: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  yield: 'low' | 'medium' | 'high';
  categories: string[];
  reference_text?: string;
};

export default function CreateQuestionPage() {
  const router = useRouter();

  const handleSubmit = async (data: QuestionFormData) => {
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

      router.push('/admin/questions');
      router.refresh();
    } catch (error) {
      console.error('Error creating question:', error);
      // Here you would typically show an error toast
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/questions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            Create Question
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <QuestionForm
          onSubmit={handleSubmit}
          isEdit={false}
        />
      </div>
    </div>
  );
}