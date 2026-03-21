"use client";

import { ReviewQueue } from "@/features/admin/questions/components/review/review-queue";
import { RequirePermission } from "@/shared/components/auth/role-guard";

export default function ReviewQueuePage() {
  return (
    <RequirePermission permission="questions.review">
      <ReviewQueue />
    </RequirePermission>
  );
}
