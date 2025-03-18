'use client';

import { useRouter } from 'next/navigation';
import { QuestionForm } from '@/components/questions/question-form';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Question } from '@/lib/types/questions';

interface PageProps {
  params: {
    id: string;
  };
}

export default function EditQuestionPage({ params }: PageProps) {
  const router = useRouter();
  const [question, setQuestion] = useState<Question | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        const response = await fetch(`/api/questions/${params.id}`);
        if (!response.ok) throw new Error('Failed to fetch question');
        const data = await response.json();
        setQuestion(data);
      } catch (error) {
        console.error('Error fetching question:', error);
        // Here you would typically show an error toast
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestion();
  }, [params.id]);

  const handleSubmit = async (data: any) => {
    try {
      const response = await fetch(`/api/questions/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Failed to update question');
      }

      router.push('/admin/questions');
      router.refresh();
    } catch (error) {
      console.error('Error updating question:', error);
      // Here you would typically show an error toast
    }
  };

  if (isLoading) {
    return <div>Loading...</div>; // You might want to use a proper loading component
  }

  if (!question) {
    return <div>Question not found</div>; // You might want to use a proper error component
  }

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
            Edit Question
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-2xl">
        <QuestionForm
          onSubmit={handleSubmit}
          isEdit={true}
          initialData={{
            body: question.body,
            difficulty: question.difficulty,
            yield: question.yield,
            explanation: question.explanation,
            reference_text: question.reference_text || undefined,
            categories: question.categories.map(c => c.id.toString()),
          }}
        />
      </div>
    </div>
  );
}