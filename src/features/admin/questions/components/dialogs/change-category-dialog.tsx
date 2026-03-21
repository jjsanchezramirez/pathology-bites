"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "@/shared/utils/ui/toast";
import { BlurredDialog } from "@/shared/components/ui/blurred-dialog";
import { Button } from "@/shared/components/ui/button";
import { Label } from "@/shared/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Loader2 } from "lucide-react";
import { apiClient } from "@/shared/utils/api/api-client";
import { QuestionWithDetails } from "@/shared/types/questions";

interface Category {
  id: string;
  name: string;
  level: number;
  parent_id?: string;
  parent_name?: string;
  parent_short_form?: string;
  short_form?: string;
}

interface ChangeCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  question: QuestionWithDetails | null;
}

export function ChangeCategoryDialog({
  open,
  onOpenChange,
  onSuccess,
  question,
}: ChangeCategoryDialogProps) {
  const [categoryId, setCategoryId] = useState<string>("");
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/questions/metadata/categories?page=0&pageSize=1000");
      if (!response.ok) throw new Error("Failed to load categories");
      const data = await response.json();
      setCategories(data.categories || []);
    } catch (error) {
      console.error("Error loading categories:", error);
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open && question) {
      setCategoryId(question.category_id || "");
      loadCategories();
    }
  }, [open, question, loadCategories]);

  // Group categories by parent (AP / CP / Other)
  const groupedCategories = useMemo(() => {
    const topLevel = categories
      .filter((c) => !c.parent_id)
      .sort((a, b) => a.name.localeCompare(b.name));

    const groups: { label: string; parentId: string | null; items: Category[] }[] = [];

    for (const parent of topLevel) {
      const children = categories
        .filter((c) => c.parent_id === parent.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      groups.push({
        label: parent.name,
        parentId: parent.id,
        items: [parent, ...children],
      });
    }

    // Include any orphan categories (no parent and not a parent themselves)
    const allGroupedIds = new Set(groups.flatMap((g) => g.items.map((c) => c.id)));
    const ungrouped = categories
      .filter((c) => !allGroupedIds.has(c.id))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (ungrouped.length > 0) {
      groups.push({ label: "Other", parentId: null, items: ungrouped });
    }

    return groups;
  }, [categories]);

  const handleSave = async () => {
    if (!question || !categoryId) return;

    setSaving(true);
    try {
      const response = await apiClient.patch(`/api/admin/questions/${question.id}`, {
        categoryId,
        changeSummary: "Changed category",
      });

      if (!response || !response.ok) {
        let message = "Failed to update category";
        if (response) {
          try {
            const errorData = await response.json();
            message = errorData.error || message;
          } catch {
            message = `Failed to update category (${response.status})`;
          }
        }
        throw new Error(message);
      }

      toast.success("Category updated");
      onOpenChange(false);
      setTimeout(() => onSuccess(), 100);
    } catch (error) {
      console.error("Error updating category:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update category");
    } finally {
      setSaving(false);
    }
  };

  return (
    <BlurredDialog
      open={open}
      onOpenChange={(v) => !saving && onOpenChange(v)}
      title="Change Category"
      description={`Change the category for "${question?.title || "this question"}".`}
      maxWidth="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !categoryId || categoryId === question?.category_id}
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
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId} disabled={saving || loading}>
          <SelectTrigger>
            <SelectValue placeholder={loading ? "Loading..." : "Select a category..."} />
          </SelectTrigger>
          <SelectContent>
            {groupedCategories.map((group) => (
              <SelectGroup key={group.label}>
                <SelectLabel>{group.label}</SelectLabel>
                {group.items.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.parent_id ? `  ${cat.name}` : cat.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>
    </BlurredDialog>
  );
}
