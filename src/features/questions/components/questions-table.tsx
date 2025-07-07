// src/components/questions/questions-table.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { toast } from 'sonner';
import { Search, Loader2, Plus, MoreVertical, Edit, Trash2, Image as ImageIcon, ChevronDown, FileText, Flag, ChevronRight, History } from 'lucide-react';
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

import { useQuestions } from '@/features/questions/hooks/use-questions';
import { QuestionWithDetails } from '@/features/questions/types/questions';
import { useQuestionSets } from '@/features/questions/hooks/use-question-sets';
import { useAuthStatus } from '@/features/auth/hooks/use-auth-status';
import { useUserRole } from '@/shared/hooks/use-user-role';
import { CreateQuestionDialog } from './create-question-dialog';
import { EditQuestionDialog } from './edit-question-dialog';
import { EnhancedImportDialog } from './enhanced-import-dialog';
import { QuestionFlagDialog } from './question-flag-dialog';
import { DeleteQuestionDialog } from './delete-question-dialog';
import { QuestionVersionHistory } from './question-version-history';
import { getQuestionSetDisplayName, getCategoryDisplayName } from '@/features/questions/utils/display-helpers';

const PAGE_SIZE = 10;

// Difficulty configuration
const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  hard: { label: 'Hard', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
} as const;

// Import the status configuration from types
import { STATUS_CONFIG } from '@/features/questions/types/questions'

// Table Controls component
function TableControls({
  onSearch,
  onDifficultyChange,
  onStatusChange,
  onQuestionSetChange,
  onCreateNew,
  onImportJson,
  difficultyFilter,
  statusFilter,
  questionSetFilter,
  questionSets,
}: {
  onSearch: (term: string) => void;
  onDifficultyChange: (difficulty: string) => void;
  onStatusChange: (status: string) => void;
  onQuestionSetChange: (questionSetId: string) => void;
  onCreateNew: () => void;
  onImportJson: () => void;
  difficultyFilter: string;
  statusFilter: string;
  questionSetFilter: string;
  questionSets: any[];
}) {
  return (
    <div className="flex gap-4 items-center justify-between">
      <div className="flex gap-4 items-center flex-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search questions..."
            onChange={(e) => onSearch(e.target.value)}
            className="pl-8"
          />
        </div>
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
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="approved_with_edits">Approved with Edits</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="published">Published</SelectItem>
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
            {questionSets.map((set) => (
              <SelectItem key={set.id} value={set.id}>
                {set.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Question
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onImportJson}>
            <FileText className="h-4 w-4 mr-2" />
            Import from JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// Pagination component
function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems: number;
}) {
  return (
    <div className="flex justify-between items-center">
      <p className="text-sm text-muted-foreground">
        Showing {totalItems > 0 ? currentPage * PAGE_SIZE + 1 : 0} to{" "}
        {Math.min((currentPage + 1) * PAGE_SIZE, totalItems)} of{" "}
        {totalItems} questions
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 0}
        >
          Previous
        </Button>
        <Button
          variant="outline"
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
  onFlag,
  onViewHistory
}: {
  question: QuestionWithDetails;
  onEdit: (question: QuestionWithDetails) => void;
  onDelete: (question: QuestionWithDetails) => void;
  onFlag?: (question: QuestionWithDetails) => void;
  onViewHistory?: (question: QuestionWithDetails) => void;
}) {
  const { isAdmin } = useUserRole();

  // Check if user can edit this question
  const canEdit = question.status !== 'published' || isAdmin;

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {canEdit ? (
          <DropdownMenuItem onClick={() => onEdit(question)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled>
            <Edit className="h-4 w-4 mr-2" />
            Edit (Admin Only)
          </DropdownMenuItem>
        )}
        {question.status === 'published' && onFlag && (
          <DropdownMenuItem onClick={() => onFlag(question)}>
            <Flag className="h-4 w-4 mr-2" />
            Flag for Review
          </DropdownMenuItem>
        )}
        {onViewHistory && (
          <DropdownMenuItem onClick={() => onViewHistory(question)}>
            <History className="h-4 w-4 mr-2" />
            Version History
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-red-600"
          onClick={() => onDelete(question)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Expandable Question Row component
function ExpandableQuestionRow({
  question,
  onEdit,
  onDelete,
  onFlag,
  onViewHistory
}: {
  question: QuestionWithDetails;
  onEdit: (question: QuestionWithDetails) => void;
  onDelete: (question: QuestionWithDetails) => void;
  onFlag?: (question: QuestionWithDetails) => void;
  onViewHistory?: (question: QuestionWithDetails) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      {/* Main Row */}
      <TableRow key={question.id}>
        <TableCell className="max-w-xs">
          <div className="flex items-start gap-2">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 p-0.5 hover:bg-muted/50 rounded flex-shrink-0"
            >
              {isExpanded ?
                <ChevronDown className="h-4 w-4 text-muted-foreground" /> :
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              }
            </button>
            <div className="flex-1 min-w-0">
              <p className="line-clamp-2 text-sm font-medium">{question.title}</p>
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Badge className={DIFFICULTY_CONFIG[question.difficulty as keyof typeof DIFFICULTY_CONFIG]?.color}>
            {DIFFICULTY_CONFIG[question.difficulty as keyof typeof DIFFICULTY_CONFIG]?.label || question.difficulty}
          </Badge>
        </TableCell>
        <TableCell className="max-w-xs">
          <p className="line-clamp-1 text-sm">
            {question.question_set ? getQuestionSetDisplayName(question.question_set) : 'No set assigned'}
          </p>
        </TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1 max-w-[150px]">
            {question.categories && question.categories.length > 0 ? (
              question.categories.slice(0, 2).map((category) => (
                <Badge
                  key={category.id}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                >
                  {getCategoryDisplayName(category)}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-muted-foreground">No category</span>
            )}
            {question.categories && question.categories.length > 2 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{question.categories.length - 2}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <Badge className={STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]?.color}>
              {STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]?.label || question.status}
            </Badge>
            {/* Show flagged indicator if question has pending flags */}
            {question.status === 'published' && question.flag_count && question.flag_count > 0 && (
              <Badge variant="destructive" className="text-xs">
                🚩 Flagged
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="text-sm">
            {question.version_string || `${question.version_major || 1}.${question.version_minor || 0}.${question.version_patch || 0}`}
            {question.change_summary && (
              <div className="text-xs text-muted-foreground mt-1" title={question.change_summary}>
                {question.change_summary.length > 30
                  ? `${question.change_summary.substring(0, 30)}...`
                  : question.change_summary
                }
              </div>
            )}
          </div>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <ImageIcon className="h-4 w-4" />
            {question.image_count || 0}
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {new Date(question.created_at).toLocaleDateString()}
        </TableCell>
        <TableCell>
          <RowActions
            question={question}
            onEdit={onEdit}
            onDelete={onDelete}
            onFlag={onFlag}
            onViewHistory={onViewHistory}
          />
        </TableCell>
      </TableRow>

      {/* Expanded Content Row */}
      {isExpanded && (
        <TableRow className="bg-muted/50">
          <TableCell colSpan={9} className="px-6 py-2">
            <div className="text-sm space-y-2">
              <div>
                <div className="font-medium mb-1 text-xs">Question Stem:</div>
                <p className="text-muted-foreground text-xs leading-relaxed">{question.stem}</p>
              </div>

              {/* Answer Options - Compact Layout */}
              {question.question_options && question.question_options.length > 0 && (
                <div>
                  <div className="font-medium mb-1 text-xs">Answer Options:</div>
                  <div className="space-y-1">
                    {question.question_options
                      .sort((a, b) => a.order_index - b.order_index)
                      .map((option, index) => (
                        <div key={option.id} className="text-xs">
                          <div className="flex items-start gap-1">
                            <span className="font-mono font-medium min-w-[16px] mt-0.5">
                              {String.fromCharCode(65 + index)}.
                            </span>
                            <div className="flex-1">
                              <span className={option.is_correct
                                ? "font-medium text-green-700 dark:text-green-400"
                                : "text-muted-foreground"
                              }>
                                {option.text}
                                {option.is_correct && <span className="ml-1 text-green-600">✓</span>}
                              </span>
                              {option.explanation && (
                                <div className="text-muted-foreground/80 mt-0.5 ml-4 italic">
                                  {option.explanation}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {question.teaching_point && (
                <div>
                  <div className="font-medium mb-1 text-xs">Teaching Point:</div>
                  <p className="text-muted-foreground text-xs">{question.teaching_point}</p>
                </div>
              )}
              {question.question_references && (
                <div>
                  <div className="font-medium mb-1 text-xs">References:</div>
                  <p className="text-muted-foreground text-xs">{question.question_references}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1 mt-1 border-t border-muted/50">
                {question.created_by_name && <span>By: {question.created_by_name}</span>}
                <span>Created: {new Date(question.created_at).toLocaleDateString()}</span>
                <span>Updated: {new Date(question.updated_at).toLocaleDateString()}</span>
                {question.version && <span>v{question.version}</span>}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

export function QuestionsTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [questionSetFilter, setQuestionSetFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithDetails | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionWithDetails | null>(null);
  const [questionToFlag, setQuestionToFlag] = useState<QuestionWithDetails | null>(null);
  const [questionForHistory, setQuestionForHistory] = useState<QuestionWithDetails | null>(null);

  // Fetch questions with current filters
  const {
    questions,
    total,
    loading,
    error,
    refetch,
    deleteQuestion,
  } = useQuestions({
    page,
    pageSize: PAGE_SIZE,
    searchTerm: searchTerm || undefined,
    difficulty: difficultyFilter === 'all' ? undefined : difficultyFilter,
    status: statusFilter === 'all' ? undefined : statusFilter,
    questionSetId: questionSetFilter === 'all' ? undefined : questionSetFilter,
  });

  // Fetch question sets for filter dropdown
  const { questionSets } = useQuestionSets();

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(0);
  }, []);

  const handleDifficultyChange = useCallback((value: string) => {
    setDifficultyFilter(value);
    setPage(0);
  }, []);

  const handleStatusChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(0);
  }, []);

  const handleQuestionSetChange = useCallback((value: string) => {
    setQuestionSetFilter(value);
    setPage(0);
  }, []);

  const handleEdit = useCallback((question: QuestionWithDetails) => {
    setSelectedQuestion(question);
    setShowEditDialog(true);
  }, []);

  const handleDelete = useCallback((question: QuestionWithDetails) => {
    setQuestionToDelete(question);
    setShowDeleteDialog(true);
  }, []);

  const handleFlag = useCallback((question: QuestionWithDetails) => {
    setQuestionToFlag(question);
    setShowFlagDialog(true);
  }, []);

  const handleViewHistory = useCallback((question: QuestionWithDetails) => {
    setQuestionForHistory(question);
    setShowVersionHistory(true);
  }, []);



  const handleCreateSave = useCallback(() => {
    setShowCreateDialog(false);
    refetch();
  }, [refetch]);

  const handleImportSave = useCallback(() => {
    setShowImportDialog(false);
    refetch();
  }, [refetch]);

  const handleEditSave = useCallback(() => {
    setShowEditDialog(false);
    setSelectedQuestion(null);
    refetch();
  }, [refetch]);

  const handleFlagSave = useCallback(() => {
    setShowFlagDialog(false);
    setQuestionToFlag(null);
    refetch();
  }, [refetch]);

  // Load questions when component mounts or filters change
  useEffect(() => {
    refetch();
  }, [refetch]);

  if (error) {
    return (
      <div className="text-center py-6">
        <p className="text-red-600">Error loading questions: {error}</p>
        <Button onClick={refetch} className="mt-2">
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TableControls
        onSearch={handleSearch}
        onDifficultyChange={handleDifficultyChange}
        onStatusChange={handleStatusChange}
        onQuestionSetChange={handleQuestionSetChange}
        onCreateNew={() => setShowCreateDialog(true)}
        onImportJson={() => setShowImportDialog(true)}
        difficultyFilter={difficultyFilter}
        statusFilter={statusFilter}
        questionSetFilter={questionSetFilter}
        questionSets={questionSets}
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Difficulty</TableHead>
              <TableHead>Question Set</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Images</TableHead>
              <TableHead className="w-32">Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : questions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  {searchTerm || difficultyFilter !== 'all' || statusFilter !== 'all' || questionSetFilter !== 'all'
                    ? 'No questions found matching your filters'
                    : 'No questions created yet'
                  }
                </TableCell>
              </TableRow>
            ) : (
              questions.map((question) => (
                <ExpandableQuestionRow
                  key={question.id}
                  question={question}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onFlag={handleFlag}
                  onViewHistory={handleViewHistory}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <TablePagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          totalItems={total}
        />
      )}

      {/* Dialogs */}
      <CreateQuestionDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSave={handleCreateSave}
      />

      <EnhancedImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onSave={handleImportSave}
      />

      {showEditDialog && selectedQuestion && (
        <EditQuestionDialog
          question={selectedQuestion}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSave={handleEditSave}
        />
      )}

      {/* Flag Dialog */}
      <QuestionFlagDialog
        question={questionToFlag}
        open={showFlagDialog}
        onOpenChange={setShowFlagDialog}
        onFlagComplete={handleFlagSave}
      />

      {/* Version History Dialog */}
      <QuestionVersionHistory
        questionId={questionForHistory?.id || ''}
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteQuestionDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        question={questionToDelete}
        onSuccess={() => {
          // Refresh the questions list
          refetch();
        }}
        onDelete={deleteQuestion}
      />
    </div>
  );
}
