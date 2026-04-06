"use client";

import { useParams } from "next/navigation";
import { LessonViewer } from "@/features/user/learn/components/lesson-viewer";

export default function LessonRoute() {
  const params = useParams();
  const subjectSlug = params.subjectSlug as string;
  const lessonSlug = params.lessonSlug as string;
  return <LessonViewer subjectSlug={subjectSlug} lessonSlug={lessonSlug} />;
}
