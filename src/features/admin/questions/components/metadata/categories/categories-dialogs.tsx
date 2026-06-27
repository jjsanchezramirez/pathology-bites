"use client";

import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { BlurredDialog } from "@/shared/components/ui/blurred-dialog";
import { Loader2, AlertTriangle } from "lucide-react";
import type { Category } from "./categories-utils";

interface DeleteCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function DeleteCategoryDialog({
  open,
  onOpenChange,
  category,
  isDeleting,
  onConfirm,
}: DeleteCategoryDialogProps) {
  return (
    <BlurredDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Category"
      description={`Are you sure you want to delete the category "${category?.name}"? This will remove it from all associated questions and cannot be undone.`}
      maxWidth="md"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete Category"
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          This action cannot be undone. The category will be permanently removed from:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>All questions currently using this category</li>
          <li>The categories database</li>
        </ul>
        {category && (category.question_count || 0) > 0 && (
          <div className="flex items-center gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-md">
            <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
            <p className="text-sm text-orange-600 dark:text-orange-400">
              This category is currently used in {category.question_count} question(s).
            </p>
          </div>
        )}
      </div>
    </BlurredDialog>
  );
}

interface BulkDeleteCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function BulkDeleteCategoriesDialog({
  open,
  onOpenChange,
  count,
  isDeleting,
  onConfirm,
}: BulkDeleteCategoriesDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Categories</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {count} selected categories? This action cannot be
            undone and will remove them from all associated questions.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              `Delete ${count} Categories`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface BulkParentCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  categories: Category[];
  selectedCategoryIds: Set<string>;
  bulkParentId: string;
  onBulkParentIdChange: (value: string) => void;
  isAssigning: boolean;
  onConfirm: () => void;
}

export function BulkParentCategoryDialog({
  open,
  onOpenChange,
  count,
  categories,
  selectedCategoryIds,
  bulkParentId,
  onBulkParentIdChange,
  isAssigning,
  onConfirm,
}: BulkParentCategoryDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Assign Parent Category</AlertDialogTitle>
          <AlertDialogDescription>
            Select a parent category for the {count} selected categories. Leave empty to make them
            top-level categories.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <Select value={bulkParentId} onValueChange={onBulkParentIdChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select parent category (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">No parent (top-level)</SelectItem>
              {categories
                .filter((cat) => !selectedCategoryIds.has(cat.id))
                .map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {"  ".repeat(category.level - 1)}
                    {category.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isAssigning}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isAssigning}>
            {isAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              `Update ${count} Categories`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
