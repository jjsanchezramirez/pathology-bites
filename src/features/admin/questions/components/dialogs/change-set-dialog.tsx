"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/shared/utils/ui/toast";
import { BlurredDialog } from "@/shared/components/ui/blurred-dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/shared/utils/api/api-client";
import { QuestionWithDetails } from "@/shared/types/questions";

interface QuestionSet {
  id: string;
  name: string;
  is_active: boolean;
}

interface ChangeSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  question: QuestionWithDetails | null;
}

export function ChangeSetDialog({ open, onOpenChange, onSuccess, question }: ChangeSetDialogProps) {
  const [setId, setSetId] = useState<string>("");
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/questions/metadata/sets?page=0&pageSize=1000");
      if (!response.ok) throw new Error("Failed to load question sets");
      const data = await response.json();
      setSets((data.sets || []).filter((s: QuestionSet) => s.is_active));
    } catch (error) {
      console.error("Error loading question sets:", error);
      toast.error("Failed to load question sets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && question) {
      setSetId(question.question_set_id || "");
      loadSets();
    }
  }, [open, question, loadSets]);

  const handleSave = async () => {
    if (!question || !setId) return;

    setSaving(true);
    try {
      const response = await apiClient.patch(`/api/admin/questions/${question.id}`, {
        questionData: { question_set_id: setId },
        changeSummary: "Changed question set",
      });

      if (!response || !response.ok) {
        let message = "Failed to update question set";
        if (response) {
          try {
            const errorData = await response.json();
            message = errorData.error || message;
          } catch {
            message = `Failed to update question set (${response.status})`;
          }
        }
        throw new Error(message);
      }

      toast.success("Question set updated");
      onOpenChange(false);
      setTimeout(() => onSuccess(), 100);
    } catch (error) {
      console.error("Error updating question set:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update question set");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BlurredDialog
      open={open}
      onOpenChange={(v) => !saving && onOpenChange(v)}
      title="Change Question Set"
      description={`Change the question set for "${question?.title || "this question"}".`}
      maxWidth="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !setId || setId === question?.question_set_id}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save"
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Label>Question Set</Label>
        <Select value={setId} onValueChange={setSetId} disabled={saving || loading}>
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading..." : "Select a question set..."} />
          </SelectTrigger>
          <SelectContent>
            {sets.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </BlurredDialog>
  );
}
