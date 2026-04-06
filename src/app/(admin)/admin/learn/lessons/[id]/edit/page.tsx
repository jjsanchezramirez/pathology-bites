"use client";

import { useParams } from "next/navigation";
import { LessonEditor } from "@/features/admin/learn/components/lesson-editor";

export default function EditLessonPage() {
  const params = useParams();
  const id = params.id as string;
  return <LessonEditor lessonId={id} />;
}
