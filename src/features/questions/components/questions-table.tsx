// src/components/questions/questions-table.tsx
'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/components/ui/table";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { toast } from 'sonner';
import { Search, Loader2, Plus, MoreVertical, Edit, Trash2, Image as ImageIcon, ChevronDown, FileText, Flag, ChevronRight, History, GitBranch, Eye, Download, Copy } from 'lucide-react';
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
import { ComponentErrorBoundary } from '@/shared/components/common';
import { useUserRole } from '@/shared/hooks/use-user-role';
import { CreateQuestionDialog } from './create-question-dialog';
import { EditQuestionDialog } from './edit-question-dialog';
import { EnhancedImportDialog } from './enhanced-import-dialog';
import { QuestionFlagDialog } from './question-flag-dialog';
import { DeleteQuestionDialog } from './delete-question-dialog';
import { QuestionVersionHistory } from './question-version-history';
import { VersionHistoryDialog } from './version-history-dialog';
import { AdminVersionUpdateDialog } from './admin-version-update-dialog';
import { QuestionPreviewDialog } from './question-preview-dialog';
import { getQuestionSetDisplayName, getCategoryDisplayName } from '@/features/questions/utils/display-helpers';
import { createClient } from '@/shared/services/client';

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
  onExportAll,
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
  onExportAll: () => void;
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
            <SelectItem value="pending">Pending Review</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
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
      <div className="flex gap-2">
        <Button variant="outline" onClick={onExportAll}>
          <Download className="h-4 w-4 mr-2" />
          Export All
        </Button>
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
  onViewHistory,
  onCreateVersion,
  onExport,
  onCopyJson
}: {
  question: QuestionWithDetails;
  onEdit: (question: QuestionWithDetails) => void;
  onDelete: (question: QuestionWithDetails) => void;
  onFlag?: (question: QuestionWithDetails) => void;
  onViewHistory?: (question: QuestionWithDetails) => void;
  onCreateVersion?: (question: QuestionWithDetails) => void;
  onExport?: (question: QuestionWithDetails) => void;
  onCopyJson?: (question: QuestionWithDetails) => void;
}) {
  const { isAdmin } = useUserRole();

  // Check if user can edit this question
  const canEdit = question.status !== 'approved' || isAdmin;

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
        {question.status === 'approved' && onFlag && (
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
        {canEdit && question.status === 'approved' && onCreateVersion && (
          <DropdownMenuItem onClick={() => onCreateVersion(question)}>
            <GitBranch className="h-4 w-4 mr-2" />
            Create Version
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {onExport && (
          <DropdownMenuItem onClick={() => onExport(question)}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </DropdownMenuItem>
        )}
        {onCopyJson && (
          <DropdownMenuItem onClick={() => onCopyJson(question)}>
            <Copy className="h-4 w-4 mr-2" />
            Copy JSON
          </DropdownMenuItem>
        )}
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

// Question Row component
function QuestionRow({
  question,
  onEdit,
  onDelete,
  onFlag,
  onViewHistory,
  onCreateVersion,
  onPreview,
  onExport,
  onCopyJson
}: {
  question: QuestionWithDetails;
  onEdit: (question: QuestionWithDetails) => void;
  onDelete: (question: QuestionWithDetails) => void;
  onFlag?: (question: QuestionWithDetails) => void;
  onViewHistory?: (question: QuestionWithDetails) => void;
  onCreateVersion?: (question: QuestionWithDetails) => void;
  onPreview?: (question: QuestionWithDetails) => void;
  onExport?: (question: QuestionWithDetails) => void;
  onCopyJson?: (question: QuestionWithDetails) => void;
}) {

  return (
    <TableRow key={question.id}>
      <TableCell className="text-center">
        {(question.flag_count || 0) > 0 && (
          <Flag className="h-4 w-4 text-red-500" />
        )}
      </TableCell>
      <TableCell className="max-w-xs">
        <div className="flex-1 min-w-0">
          <p className="line-clamp-2 text-sm font-medium">{question.title}</p>
        </div>
      </TableCell>
        <TableCell>
          <Badge className={STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]?.color}>
            {STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]?.label || question.status}
          </Badge>
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
        <TableCell className="max-w-xs">
          <p className="line-clamp-1 text-sm">
            {question.question_set ? getQuestionSetDisplayName(question.question_set) : 'No set assigned'}
          </p>
        </TableCell>
        <TableCell>
          <div className="text-sm">
            {question.version_string || `${question.version_major || 1}.${question.version_minor || 0}.${question.version_patch || 0}`}
          </div>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground">
          {new Date(question.created_at).toLocaleDateString()}
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
            onFlag={onFlag}
            onViewHistory={onViewHistory}
            onCreateVersion={onCreateVersion}
            onExport={onExport}
            onCopyJson={onCopyJson}
          />
        </TableCell>
      </TableRow>
  );
}

export function QuestionsTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [questionSetFilter, setQuestionSetFilter] = useState('all');
  const [page, setPage] = useState(0);

  const supabase = createClient();
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithDetails | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showVersionUpdateDialog, setShowVersionUpdateDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionWithDetails | null>(null);
  const [questionToFlag, setQuestionToFlag] = useState<QuestionWithDetails | null>(null);
  const [questionForHistory, setQuestionForHistory] = useState<QuestionWithDetails | null>(null);
  const [questionToPreview, setQuestionToPreview] = useState<QuestionWithDetails | null>(null);
  const [questionForVersionUpdate, setQuestionForVersionUpdate] = useState<QuestionWithDetails | null>(null);

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

  const handleEdit = useCallback(async (question: QuestionWithDetails) => {
    try {
      // Fetch the full question details from the API to ensure we have all related data
      const response = await fetch(`/api/admin/questions/${question.id}`)

      if (response.ok) {
        const data = await response.json()
        const { question: questionDetails } = data
        setSelectedQuestion(questionDetails)
        setShowEditDialog(true)
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error('Failed to fetch question details:', response.status, errorData)
        toast.error('Failed to load question details')
      }
    } catch (error) {
      console.error('Failed to fetch question details:', error)
      toast.error('Failed to load question details')
    }
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

  const handleCreateVersion = useCallback((question: QuestionWithDetails) => {
    setQuestionForVersionUpdate(question);
    setShowVersionUpdateDialog(true);
  }, []);

  const handlePreview = useCallback(async (question: QuestionWithDetails) => {
    try {
      // Fetch complete question data with options and images for preview
      const { data: fullQuestion, error } = await supabase
        .from('questions')
        .select(`
          *,
          question_options(*),
          question_images(*, image:images(*)),
          categories(*)
        `)
        .eq('id', question.id)
        .single()

      if (error) {
        console.error('Error fetching full question data:', error)
        toast.error('Failed to load question details')
        return
      }

      setQuestionToPreview(fullQuestion)
      setShowPreviewDialog(true)
    } catch (error) {
      console.error('Error fetching question for preview:', error)
      toast.error('Failed to load question preview')
    }
  }, []);

  const handleExportQuestion = useCallback(async (question: QuestionWithDetails) => {
    try {
      const response = await fetch(`/api/questions/${question.id}/export`);
      if (!response.ok) {
        throw new Error('Failed to export question');
      }

      const questionData = await response.json();

      // Create and download the file
      const blob = new Blob([JSON.stringify(questionData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `question-${question.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Question exported successfully');
    } catch (error) {
      console.error('Error exporting question:', error);
      toast.error('Failed to export question');
    }
  }, []);

  const handleExportAll = useCallback(async () => {
    try {
      const response = await fetch('/api/questions/export');
      if (!response.ok) {
        throw new Error('Failed to export questions');
      }

      const questionsData = await response.json();

      // Create and download the file
      const blob = new Blob([JSON.stringify(questionsData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pathology-bites-questions-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('All questions exported successfully');
    } catch (error) {
      console.error('Error exporting questions:', error);
      toast.error('Failed to export questions');
    }
  }, []);

  const handleCopyJsonQuestion = useCallback(async (question: QuestionWithDetails) => {
    try {
      const response = await fetch(`/api/questions/${question.id}/export`);
      if (!response.ok) {
        throw new Error('Failed to fetch question data');
      }

      const questionData = await response.json();

      // Copy to clipboard
      await navigator.clipboard.writeText(JSON.stringify(questionData, null, 2));

      toast.success('Question JSON copied to clipboard');
    } catch (error) {
      console.error('Error copying question JSON:', error);
      toast.error('Failed to copy question JSON');
    }
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

  const handleVersionUpdateSave = useCallback(() => {
    setShowVersionUpdateDialog(false);
    setQuestionForVersionUpdate(null);
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
    <ComponentErrorBoundary componentName="Questions Table">
      <div className="space-y-4">
      <TableControls
        onSearch={handleSearch}
        onDifficultyChange={handleDifficultyChange}
        onStatusChange={handleStatusChange}
        onQuestionSetChange={handleQuestionSetChange}
        onCreateNew={() => setShowCreateDialog(true)}
        onImportJson={() => setShowImportDialog(true)}
        onExportAll={handleExportAll}
        difficultyFilter={difficultyFilter}
        statusFilter={statusFilter}
        questionSetFilter={questionSetFilter}
        questionSets={questionSets}
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Set</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="w-32">Created</TableHead>
              <TableHead className="w-[50px]"></TableHead>
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
                <QuestionRow
                  key={question.id}
                  question={question}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onFlag={handleFlag}
                  onViewHistory={handleViewHistory}
                  onCreateVersion={handleCreateVersion}
                  onPreview={handlePreview}
                  onExport={handleExportQuestion}
                  onCopyJson={handleCopyJsonQuestion}
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

      {/* Preview Dialog */}
      <QuestionPreviewDialog
        question={questionToPreview}
        open={showPreviewDialog}
        onOpenChange={setShowPreviewDialog}
      />

      <EditQuestionDialog
        question={selectedQuestion}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSave={handleEditSave}
      />

      {/* Flag Dialog */}
      <QuestionFlagDialog
        question={questionToFlag}
        open={showFlagDialog}
        onOpenChange={setShowFlagDialog}
        onFlagComplete={handleFlagSave}
      />

      {/* Version History Dialog */}
      <VersionHistoryDialog
        questionId={questionForHistory?.id || null}
        questionTitle={questionForHistory?.title}
        open={showVersionHistory}
        onOpenChange={setShowVersionHistory}
      />

      {/* Admin Version Update Dialog */}
      <AdminVersionUpdateDialog
        questionId={questionForVersionUpdate?.id || null}
        questionTitle={questionForVersionUpdate?.title}
        currentVersion={questionForVersionUpdate?.version_string}
        open={showVersionUpdateDialog}
        onOpenChange={setShowVersionUpdateDialog}
        onVersionCreated={handleVersionUpdateSave}
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
    </ComponentErrorBoundary>
  );
}
