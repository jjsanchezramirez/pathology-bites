// src/components/questions/questions-table.tsx
'use client';

import { useState, useCallback, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Loader2, Plus, MoreVertical, Edit, Trash2, Image as ImageIcon } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQuestions, QuestionWithDetails } from '@/hooks/use-questions';
import { useQuestionSets } from '@/hooks/use-question-sets';
import { CreateQuestionDialog } from './create-question-dialog';
import { EditQuestionDialog } from './edit-question-dialog';

const PAGE_SIZE = 10;

// Difficulty configuration
const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
  hard: { label: 'Hard', color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
} as const;

// Status configuration
const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300' },
  published: { label: 'Published', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
  archived: { label: 'Archived', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' },
} as const;

// Table Controls component
function TableControls({
  onSearch,
  onDifficultyChange,
  onStatusChange,
  onQuestionSetChange,
  onCreateNew,
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
            <SelectItem value="published">Published</SelectItem>
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
      <Button onClick={onCreateNew}>
        <Plus className="h-4 w-4 mr-2" />
        Add Question
      </Button>
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
  onDelete
}: {
  question: QuestionWithDetails;
  onEdit: (question: QuestionWithDetails) => void;
  onDelete: (question: QuestionWithDetails) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(question)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit
        </DropdownMenuItem>
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

export function QuestionsTable() {
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [questionSetFilter, setQuestionSetFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionWithDetails | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<QuestionWithDetails | null>(null);

  const { toast } = useToast();

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

  const handleConfirmDelete = useCallback(async () => {
    if (!questionToDelete) return;

    try {
      await deleteQuestion(questionToDelete.id);
      setShowDeleteDialog(false);
      setQuestionToDelete(null);
    } catch (error) {
      // Error is already handled in the hook
    }
  }, [questionToDelete, deleteQuestion]);

  const handleCreateSave = useCallback(() => {
    setShowCreateDialog(false);
    refetch();
  }, [refetch]);

  const handleEditSave = useCallback(() => {
    setShowEditDialog(false);
    setSelectedQuestion(null);
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
              <TableHead>Status</TableHead>
              <TableHead>Images</TableHead>
              <TableHead className="w-32">Created</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : questions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {searchTerm || difficultyFilter !== 'all' || statusFilter !== 'all' || questionSetFilter !== 'all'
                    ? 'No questions found matching your filters'
                    : 'No questions created yet'
                  }
                </TableCell>
              </TableRow>
            ) : (
              questions.map((question) => (
                <TableRow key={question.id}>
                  <TableCell className="max-w-xs">
                    <p className="line-clamp-2 text-sm font-medium">{question.title}</p>
                  </TableCell>
                  <TableCell>
                    <Badge className={DIFFICULTY_CONFIG[question.difficulty as keyof typeof DIFFICULTY_CONFIG]?.color}>
                      {DIFFICULTY_CONFIG[question.difficulty as keyof typeof DIFFICULTY_CONFIG]?.label || question.difficulty}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="line-clamp-1 text-sm">
                      {question.question_set?.name || 'No set assigned'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]?.color}>
                      {STATUS_CONFIG[question.status as keyof typeof STATUS_CONFIG]?.label || question.status}
                    </Badge>
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
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  </TableCell>
                </TableRow>
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

      {showEditDialog && selectedQuestion && (
        <EditQuestionDialog
          question={selectedQuestion}
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          onSave={handleEditSave}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{questionToDelete?.title}"? This action cannot be undone.
              All associated answer options and images will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
