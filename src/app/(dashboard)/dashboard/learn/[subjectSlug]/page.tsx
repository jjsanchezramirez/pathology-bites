"use client";

import { useParams } from "next/navigation";
import { SubjectPage } from "@/features/user/learn/components/subject-page";

export default function SubjectRoute() {
  const params = useParams();
  const slug = params.subjectSlug as string;
  return <SubjectPage slug={slug} />;
}
