"use client";

import { useRouter } from "next/navigation";
import { toast } from "@/shared/utils/ui/toast";
import { MultiStepQuestionForm } from "@/features/admin/questions/components/create/multi-step-question-form";
import { QuestionFormData } from "@/shared/types/questions";
import { apiClient } from "@/shared/utils/api/api-client";

export function CreateQuestionClient() {
  const router = useRouter();

  // Handle form submission
  const handleSubmit = async (data: QuestionFormData) => {
    try {
      const response = await apiClient.post("/api/admin/questions/create", data);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create question");
      }

      toast.success("Question created successfully!");
      router.push("/admin/questions");
      router.refresh();
    } catch (error) {
      console.error("Error creating question:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create question");
      throw error; // Re-throw to let the form handle it
    }
  };

  const handleCancel = () => {
    router.push("/admin/questions");
  };

  return (
    <div className="space-y-6">
      <MultiStepQuestionForm onSubmit={handleSubmit} onCancel={handleCancel} />
    </div>
  );
}
