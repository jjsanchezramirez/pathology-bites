"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LessonEditor } from "@/features/admin/learn/components/lesson-editor";
import { Loader2 } from "lucide-react";

function CreateLessonContent() {
  const searchParams = useSearchParams();
  const subjectId = searchParams.get("subject_id") || undefined;
  const subjectTitle = searchParams.get("subject_title") || undefined;

  return <LessonEditor subjectId={subjectId} subjectTitle={subjectTitle} />;
}

export default function CreateLessonPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <CreateLessonContent />
    </Suspense>
  );
}
