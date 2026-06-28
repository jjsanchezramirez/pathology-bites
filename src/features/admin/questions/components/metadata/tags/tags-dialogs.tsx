"use client";

import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { BlurredDialog } from "@/shared/components/ui/blurred-dialog";
import { Loader2 } from "lucide-react";
import type { Tag, TagQuestion } from "./tags-utils";

interface DeleteTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function DeleteTagDialog({
  open,
  onOpenChange,
  tag,
  isDeleting,
  onConfirm,
}: DeleteTagDialogProps) {
  return (
    <BlurredDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Tag"
      description={`Are you sure you want to delete the tag "${tag?.name}"? This will remove it from all associated questions and cannot be undone.`}
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
          <Button onClick={onConfirm} disabled={isDeleting} variant="destructive">
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </>
      }
    >
      <div className="py-2">
        <p className="text-sm text-muted-foreground">
          This action cannot be undone. The tag will be permanently removed from the system.
        </p>
      </div>
    </BlurredDialog>
  );
}

interface BulkDeleteTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  isDeleting: boolean;
  onConfirm: () => void;
}

export function BulkDeleteTagsDialog({
  open,
  onOpenChange,
  count,
  isDeleting,
  onConfirm,
}: BulkDeleteTagsDialogProps) {
  return (
    <BlurredDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Selected Tags"
      description={`Are you sure you want to delete ${count} selected tag${count === 1 ? "" : "s"}? This will remove them from all associated questions and cannot be undone.`}
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
          <Button onClick={onConfirm} disabled={isDeleting} variant="destructive">
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              `Delete ${count} Tag${count === 1 ? "" : "s"}`
            )}
          </Button>
        </>
      }
    >
      <div className="py-2">
        <p className="text-sm text-muted-foreground">
          This action cannot be undone. All selected tags will be permanently removed from the
          system and from all associated questions.
        </p>
      </div>
    </BlurredDialog>
  );
}

interface MergeTagsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedTags: Tag[];
  mergeTargetTag: Tag | null;
  onSelectTarget: (tag: Tag) => void;
  isMerging: boolean;
  onConfirm: () => void;
}

export function MergeTagsDialog({
  open,
  onOpenChange,
  selectedTags,
  mergeTargetTag,
  onSelectTarget,
  isMerging,
  onConfirm,
}: MergeTagsDialogProps) {
  return (
    <BlurredDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Merge Tags"
      description="Select a target tag to merge the selected tags into. All questions will be reassigned to the target tag."
      maxWidth="lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMerging}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={!mergeTargetTag || isMerging}>
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              "Merge Tags"
            )}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Target Tag Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Target Tag:</label>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-full justify-start">
                {mergeTargetTag ? mergeTargetTag.name : "Select target tag..."}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-full">
              {selectedTags.map((tag) => (
                <DropdownMenuItem key={tag.id} onClick={() => onSelectTarget(tag)}>
                  {tag.name} ({tag.question_count || 0} questions)
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Preview Section */}
        {mergeTargetTag && (
          <div className="space-y-3 border-t pt-3">
            <h4 className="text-sm font-medium">Merge Preview:</h4>

            {/* Tags to be merged */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Tags to be merged (will be deleted):</p>
              <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-md border">
                {selectedTags
                  .filter((tag) => tag.id !== mergeTargetTag.id)
                  .map((tag) => (
                    <Badge key={tag.id} variant="outline" className="text-xs">
                      {tag.name} ({tag.question_count || 0})
                    </Badge>
                  ))}
              </div>
            </div>

            {/* Target tag */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Into target tag:</p>
              <div className="p-3 bg-primary/10 rounded-md border border-primary/20">
                <Badge variant="default" className="text-xs">
                  {mergeTargetTag.name} ({mergeTargetTag.question_count || 0} questions)
                </Badge>
              </div>
            </div>

            {/* Summary */}
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-900">
              <p className="text-xs text-blue-900 dark:text-blue-300">
                <strong>Result:</strong> {selectedTags.length - 1} tag
                {selectedTags.length - 1 === 1 ? "" : "s"} will be deleted, and their questions will
                be reassigned to "{mergeTargetTag.name}".
              </p>
            </div>
          </div>
        )}
      </div>
    </BlurredDialog>
  );
}

interface ViewQuestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  questions: TagQuestion[];
  loading: boolean;
  questionsPage: number;
  onQuestionsPageChange: (page: number) => void;
  questionsPageSize: number;
}

export function ViewQuestionsDialog({
  open,
  onOpenChange,
  tag,
  questions,
  loading,
  questionsPage,
  onQuestionsPageChange,
  questionsPageSize,
}: ViewQuestionsDialogProps) {
  const totalQuestionPages = Math.ceil(questions.length / questionsPageSize);

  return (
    <BlurredDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Questions with tag: ${tag?.name || ""}`}
      description={`Showing ${questions.length} question${questions.length === 1 ? "" : "s"} that use this tag.`}
      maxWidth="2xl"
      footer={
        <div className="flex items-center justify-between w-full">
          {/* Pagination */}
          {questions.length > questionsPageSize && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                Page {questionsPage + 1} of {totalQuestionPages}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onQuestionsPageChange(Math.max(0, questionsPage - 1))}
                  disabled={questionsPage === 0}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onQuestionsPageChange(Math.min(totalQuestionPages - 1, questionsPage + 1))
                  }
                  disabled={questionsPage >= totalQuestionPages - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="ml-auto"
          >
            Close
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading questions...</span>
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No questions found with this tag
          </div>
        ) : (
          <div className="space-y-3">
            {questions
              .slice(questionsPage * questionsPageSize, (questionsPage + 1) * questionsPageSize)
              .map((question, index) => (
                <div key={question.id} className="border rounded-lg p-3 hover:bg-muted/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm mb-1">
                        {question.title ||
                          `Question ${questionsPage * questionsPageSize + index + 1}`}
                      </div>
                      <div className="text-sm text-muted-foreground line-clamp-2">
                        {question.stem || "No question content available"}
                      </div>
                      {question.category && (
                        <div className="mt-2">
                          <Badge variant="outline" className="text-xs">
                            {question.category}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </BlurredDialog>
  );
}
