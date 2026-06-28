"use client";

import React from "react";
import { TableCell, TableRow } from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { CategoryBadge } from "@/shared/components/ui/category-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import {
  Eye,
  Edit3,
  Send,
  ChevronDown,
  ChevronRight,
  Flag,
  AlertTriangle,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FLAG_TYPE_CONFIG } from "@/shared/types/questions";
import { formatVersion } from "@/shared/utils/version";
import { type MyQuestion, getAgeTier } from "./my-questions-utils";

function AgeIndicator({ updatedAt }: { updatedAt: string }) {
  const tier = getAgeTier(updatedAt);
  if (tier === "urgent") {
    return (
      <Badge variant="outline" className="ml-2 text-xs border-red-300 bg-red-50 text-red-700">
        Urgent
      </Badge>
    );
  }
  if (tier === "aging") {
    return (
      <Badge variant="outline" className="ml-2 text-xs border-amber-300 bg-amber-50 text-amber-700">
        Aging
      </Badge>
    );
  }
  return null;
}

interface MyQuestionRowProps {
  question: MyQuestion;
  activeTab: string;
  isCollapsed: boolean;
  isSelected: boolean;
  colSpan: number;
  onToggleFeedback: (id: string) => void;
  onSelectQuestion: (id: string, checked: boolean) => void;
  onPreview: (id: string) => void;
  onEditAndResubmit: (id: string) => void;
  onSubmitForReview: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (ids: string[]) => void;
}

export function MyQuestionRow({
  question,
  activeTab,
  isCollapsed,
  isSelected,
  colSpan,
  onToggleFeedback,
  onSelectQuestion,
  onPreview,
  onEditAndResubmit,
  onSubmitForReview,
  onEdit,
  onDelete,
}: MyQuestionRowProps) {
  const showFeedback =
    (activeTab === "revision" && !!question.reviewer_feedback) ||
    (activeTab === "flagged" && !!question.flag_info);

  return (
    <React.Fragment>
      <TableRow>
        {activeTab === "drafts" && (
          <TableCell>
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => onSelectQuestion(question.id, !!checked)}
            />
          </TableCell>
        )}
        <TableCell>
          <div className="space-y-3">
            {/* Question Title */}
            <div className="flex items-start gap-2">
              {showFeedback && (
                <button
                  onClick={() => onToggleFeedback(question.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 mt-0.5"
                  aria-label={isCollapsed ? "Expand feedback" : "Collapse feedback"}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
              )}
              {!showFeedback && (activeTab === "revision" || activeTab === "flagged") && (
                <div className="w-6 flex-shrink-0" />
              )}
              <div className="flex-1">
                <div className="font-medium flex items-center">
                  {question.title}
                  {(activeTab === "revision" || activeTab === "flagged") && (
                    <AgeIndicator updatedAt={question.updated_at} />
                  )}
                </div>
              </div>
            </div>

            {/* Question Stem */}
            <div className="flex gap-2">
              {(activeTab === "revision" || activeTab === "flagged") && (
                <div className="w-6 flex-shrink-0" />
              )}
              <div className="text-sm text-muted-foreground line-clamp-2 flex-1">
                {question.stem}
              </div>
            </div>

            {/* Metadata row: category + set + timestamp */}
            <div className="flex gap-2">
              {(activeTab === "revision" || activeTab === "flagged") && (
                <div className="w-6 flex-shrink-0" />
              )}
              <div className="flex items-center flex-wrap gap-2 text-xs text-muted-foreground">
                {question.category && (
                  <CategoryBadge
                    category={{
                      id: question.category.id,
                      color: question.category.color ?? undefined,
                      short_form: question.category.short_form ?? undefined,
                      name: question.category.name,
                    }}
                  />
                )}
                {question.question_set && (
                  <Badge variant="outline" className="text-xs">
                    {question.question_set.name}
                  </Badge>
                )}
                <span>
                  {activeTab === "revision"
                    ? "Rejected "
                    : activeTab === "flagged"
                      ? "Flagged "
                      : "Updated "}
                  {formatDistanceToNow(new Date(question.updated_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>

            {/* Resubmission Notes */}
            {(activeTab === "revision" || activeTab === "flagged") &&
              question.resubmission_notes && (
                <div className="flex gap-2">
                  <div className="w-6 flex-shrink-0" />
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-500 dark:border-blue-600 rounded-md flex-1">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-blue-900 dark:text-blue-100 block mb-1">
                          Previous Changes Made
                        </span>
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                          {question.resubmission_notes}
                        </p>
                        {question.resubmission_date && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {formatDistanceToNow(new Date(question.resubmission_date))} ago
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
          </div>
        </TableCell>
        {/* Version column only for Published tab */}
        {activeTab === "published" && (
          <TableCell>
            <div className="text-sm font-mono">
              {formatVersion(
                question.version_major,
                question.version_minor,
                question.version_patch
              )}
            </div>
          </TableCell>
        )}
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onPreview(question.id)}>
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </Button>
            {(activeTab === "revision" || activeTab === "flagged") && (
              <Button size="sm" onClick={() => onEditAndResubmit(question.id)}>
                <Edit3 className="h-4 w-4 mr-1" />
                Resubmit
              </Button>
            )}
            {activeTab === "drafts" && (
              <Button size="sm" onClick={() => onSubmitForReview(question.id)}>
                <Send className="h-4 w-4 mr-1" />
                Submit
              </Button>
            )}
            {activeTab === "published" && (
              <Button size="sm" onClick={() => onEdit(question.id)}>
                <Edit3 className="h-4 w-4 mr-1" />
                Patch
              </Button>
            )}
            {activeTab === "drafts" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                    <span className="sr-only">Open menu</span>
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEdit(question.id)}>
                    <Edit3 className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete([question.id])}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </TableCell>
      </TableRow>

      {/* Reviewer Feedback / Flag Reason Row */}
      {showFeedback && !isCollapsed && (
        <TableRow className="bg-muted/50 border-t">
          <TableCell colSpan={colSpan} className="py-6 pl-6 pr-6">
            <div className="flex items-start gap-2">
              <div className="w-6 flex-shrink-0 flex justify-center">
                {activeTab === "flagged" ? (
                  <Flag className="h-4 w-4 text-orange-500 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                )}
              </div>
              <div className="flex-1">
                {activeTab === "flagged" && question.flag_info ? (
                  <>
                    <h4 className="text-sm font-semibold mb-2">
                      Flagged:{" "}
                      {FLAG_TYPE_CONFIG[
                        question.flag_info.flag_type as keyof typeof FLAG_TYPE_CONFIG
                      ]?.label ?? question.flag_info.flag_type}
                    </h4>
                    {question.flag_info.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap mb-2">
                        {question.flag_info.description}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Flagged by {question.flag_info.flagged_by_name}{" "}
                      {formatDistanceToNow(new Date(question.flag_info.created_at))} ago
                    </p>
                  </>
                ) : (
                  <>
                    <h4 className="text-sm font-semibold mb-2">Reviewer Feedback</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {question.reviewer_feedback}
                    </p>
                  </>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </React.Fragment>
  );
}
