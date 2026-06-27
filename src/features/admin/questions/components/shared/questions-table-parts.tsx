"use client";

import { TableCell, TableRow } from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Search,
  MoreVertical,
  Edit,
  Trash2,
  Flag,
  History,
  Eye,
  Download,
  Check,
  X,
  Send,
  FolderEdit,
  BookOpen,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { QuestionWithDetails } from "@/shared/types/questions";
import { useAuthContext } from "@/features/auth/components/auth-provider";
import { useUserRole } from "@/shared/hooks/use-user-role";
import { shouldShowDeleteButton } from "@/features/admin/questions/utils/deletion-helpers";
import { CATEGORIES } from "@/shared/config/categories";
import { CategoryBadge } from "@/shared/components/ui/category-badge";
import { StatusBadge } from "@/shared/components/ui/status-badge";

export const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const getVersionString = (question: QuestionWithDetails): string => {
  const major = question.version_major ?? 1;
  const minor = question.version_minor ?? 0;
  const patch = question.version_patch ?? 0;
  return `v${major}.${minor}.${patch}`;
};

// Table Controls component
export function TableControls({
  onSearch,
  onDifficultyChange,
  onStatusChange,
  onQuestionSetChange,
  onCategoryChange,
  onExportAll,
  difficultyFilter,
  statusFilter,
  questionSetFilter,
  categoryFilter,
  questionSets,
  selectedQuestions,
  onBulkOperation,
  isAdmin,
}: {
  onSearch: (term: string) => void;
  onDifficultyChange: (difficulty: string) => void;
  onStatusChange: (status: string) => void;
  onQuestionSetChange: (questionSetId: string) => void;
  onCategoryChange: (categoryId: string) => void;
  onExportAll: () => void;
  difficultyFilter: string;
  statusFilter: string;
  questionSetFilter: string;
  categoryFilter: string;
  questionSets: unknown[];
  selectedQuestions: string[];
  onBulkOperation: (action: string) => void;
  isAdmin: boolean;
}) {
  const pathologyCategories = CATEGORIES.filter((cat) => cat.level === 2).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return (
    <div className="space-y-4">
      {/* Search and Filters Row */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by title or stem..."
            onChange={(e) => onSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={onCategoryChange}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All Categories</SelectItem>
            {pathologyCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.shortForm} — {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={difficultyFilter} onValueChange={onDifficultyChange}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Difficulties</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_review">Pending Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={questionSetFilter} onValueChange={onQuestionSetChange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Question Set" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Question Sets</SelectItem>
            {questionSets.map((set: { id: string; name: string }) => (
              <SelectItem key={set.id} value={set.id}>
                {set.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={onExportAll}>
          <Download className="h-4 w-4 mr-2" />
          Export All
        </Button>
      </div>

      {/* Bulk Operations Row - Only shown for admins when questions are selected */}
      {isAdmin && selectedQuestions.length > 0 && (
        <div className="flex gap-2 items-center p-3 bg-muted/50 rounded-lg border">
          <span className="text-sm font-medium mr-2">{selectedQuestions.length} selected</span>
          <Button variant="outline" size="sm" onClick={() => onBulkOperation("submit_for_review")}>
            <Send className="h-4 w-4 mr-2" />
            Submit for Review
          </Button>
          <Button variant="outline" size="sm" onClick={() => onBulkOperation("approve")}>
            <Check className="h-4 w-4 mr-2" />
            Approve
          </Button>
          <Button variant="outline" size="sm" onClick={() => onBulkOperation("reject")}>
            <X className="h-4 w-4 mr-2" />
            Reject
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onBulkOperation("delete")}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
          <Button variant="outline" size="sm" onClick={() => onBulkOperation("export")}>
            <Download className="h-4 w-4 mr-2" />
            Export Selected
          </Button>
        </div>
      )}
    </div>
  );
}

// Build visible page numbers with ellipsis gaps
function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  const pages: (number | "ellipsis")[] = [];

  // Always show first page
  pages.push(0);

  if (currentPage > 2) {
    pages.push("ellipsis");
  }

  // Pages around current
  const start = Math.max(1, currentPage - 1);
  const end = Math.min(totalPages - 2, currentPage + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 3) {
    pages.push("ellipsis");
  }

  // Always show last page
  pages.push(totalPages - 1);

  return pages;
}

// Pagination component
export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  onPageSizeChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
}) {
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  return (
    <div className="flex justify-between items-center">
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted-foreground">
          Showing {totalItems > 0 ? currentPage * pageSize + 1 : 0} to{" "}
          {Math.min((currentPage + 1) * pageSize, totalItems)} of {totalItems} questions
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="text-sm border rounded px-2 py-1 bg-background"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
        >
          Previous
        </Button>
        {pageNumbers.map((p, idx) =>
          p === "ellipsis" ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-sm text-muted-foreground">
              ...
            </span>
          ) : (
            <Button
              key={p}
              variant={p === currentPage ? "default" : "outline"}
              size="sm"
              className="min-w-[36px]"
              onClick={() => onPageChange(p)}
            >
              {p + 1}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// Row Actions component
function RowActions({
  question,
  onEdit,
  onDelete,
  onViewHistory,
  onExport,
  onEditCategory,
  onEditSet,
}: {
  question: QuestionWithDetails;
  onEdit: (question: QuestionWithDetails) => void;
  onDelete: (question: QuestionWithDetails) => void;
  onViewHistory?: (question: QuestionWithDetails) => void;
  onExport?: (question: QuestionWithDetails) => void;
  onEditCategory?: (question: QuestionWithDetails) => void;
  onEditSet?: (question: QuestionWithDetails) => void;
}) {
  const { isAdmin, role } = useUserRole();
  const { user } = useAuthContext();

  // Check if user can edit this question
  const canEdit = question.status !== "published" || isAdmin;

  // Check if user can delete this question
  const canDelete = shouldShowDeleteButton(question, role, user?.id || null);

  // Hide version history when question is at the initial v1.0.0 (nothing to show)
  const hasVersionBeyondInitial =
    (question.version_major || 1) > 1 ||
    (question.version_minor || 0) > 0 ||
    (question.version_patch || 0) > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canEdit && (
          <DropdownMenuItem onClick={() => onEdit(question)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
        )}
        {isAdmin && onEditCategory && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setTimeout(() => onEditCategory(question), 0);
            }}
          >
            <FolderEdit className="h-4 w-4 mr-2" />
            Change Category
          </DropdownMenuItem>
        )}
        {isAdmin && onEditSet && (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setTimeout(() => onEditSet(question), 0);
            }}
          >
            <BookOpen className="h-4 w-4 mr-2" />
            Change Question Set
          </DropdownMenuItem>
        )}
        {hasVersionBeyondInitial && onViewHistory && (
          <DropdownMenuItem onClick={() => onViewHistory(question)}>
            <History className="h-4 w-4 mr-2" />
            Version History
          </DropdownMenuItem>
        )}
        {onExport && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onExport(question)}>
              <Download className="h-4 w-4 mr-2" />
              Export JSON
            </DropdownMenuItem>
          </>
        )}
        {canDelete && (
          <DropdownMenuItem className="text-red-600" onClick={() => onDelete(question)}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Question Row component
export function QuestionRow({
  question,
  onEdit,
  onDelete,
  onViewHistory,
  onPreview,
  onExport,
  onEditCategory,
  onEditSet,
  isSelected,
  onSelect,
  isAdmin,
}: {
  question: QuestionWithDetails;
  onEdit: (question: QuestionWithDetails) => void;
  onDelete: (question: QuestionWithDetails) => void;
  onViewHistory?: (question: QuestionWithDetails) => void;
  onPreview?: (question: QuestionWithDetails) => void;
  onExport?: (question: QuestionWithDetails) => void;
  onEditCategory?: (question: QuestionWithDetails) => void;
  onEditSet?: (question: QuestionWithDetails) => void;
  isSelected: boolean;
  onSelect: (questionId: string, checked: boolean) => void;
  isAdmin: boolean;
}) {
  return (
    <TableRow key={question.id}>
      {isAdmin && (
        <TableCell className="text-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => onSelect(question.id, checked as boolean)}
          />
        </TableCell>
      )}
      <TableCell className="text-center">
        {(question.flag_count || 0) > 0 && <Flag className="h-4 w-4 text-red-500" />}
      </TableCell>
      <TableCell className="min-w-[320px]">
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="line-clamp-2 text-sm font-medium">{question.title}</p>
          <div className="flex items-center flex-wrap gap-1.5">
            <StatusBadge status={question.status} className="text-[10px] px-1.5 py-0" />
            {question.category && (
              <CategoryBadge
                category={{
                  id: question.category.id,
                  color: question.category.color ?? undefined,
                  short_form: question.category.short_form ?? undefined,
                  name: question.category.name,
                }}
                className="text-[10px] px-1.5 py-0"
              />
            )}
            {question.question_set && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {question.question_set.short_form || question.question_set.name}
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
              {getVersionString(question)}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            Created by {question.created_by_name || "Unknown"} on{" "}
            {new Date(question.created_at).toLocaleDateString("en-US", {
              month: "numeric",
              day: "numeric",
              year: "2-digit",
            })}{" "}
            · Last updated by {question.updated_by_name || "Unknown"} on{" "}
            {new Date(question.updated_at).toLocaleDateString("en-US", {
              month: "numeric",
              day: "numeric",
              year: "2-digit",
            })}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center">
        {onPreview && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPreview(question)}
            className="h-8 w-8 p-0"
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </TableCell>
      <TableCell>
        <RowActions
          question={question}
          onEdit={onEdit}
          onDelete={onDelete}
          onViewHistory={onViewHistory}
          onExport={onExport}
          onEditCategory={onEditCategory}
          onEditSet={onEditSet}
        />
      </TableCell>
    </TableRow>
  );
}
