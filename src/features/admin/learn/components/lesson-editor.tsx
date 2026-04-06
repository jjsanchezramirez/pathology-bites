"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { adminLearnService } from "../services/admin-learn-service";
import { Lesson } from "@/features/user/learn/types/lesson";
import {
  LessonContent,
  LessonQuiz,
  LessonQuizQuestion,
} from "@/features/user/learn/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  Image as ImageIcon,
  Play,
  Lightbulb,
  Table2,
  Heading2,
  List,
  Bold,
  Italic,
  Quote,
  Minus,
  Eye,
  Edit3,
} from "lucide-react";
import Link from "next/link";
import { ImagePickerDialog } from "./image-picker-dialog";
import { SequencePickerDialog } from "./sequence-picker-dialog";
import {
  MarkdownLessonRenderer,
  extractImageIds,
} from "@/features/user/learn/components/markdown-lesson-renderer";

interface LessonEditorProps {
  lessonId?: string;
  subjectId?: string;
  subjectTitle?: string;
}

// Insert text at cursor position in a textarea
function insertAtCursor(
  textarea: HTMLTextAreaElement,
  text: string,
  selectStart?: number,
  selectEnd?: number
): string {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  const newValue = before + text + after;

  // Schedule cursor positioning after React re-render
  requestAnimationFrame(() => {
    textarea.focus();
    const cursorPos = selectStart !== undefined
      ? start + selectStart
      : start + text.length;
    const cursorEnd = selectEnd !== undefined
      ? start + selectEnd
      : cursorPos;
    textarea.setSelectionRange(cursorPos, cursorEnd);
  });

  return newValue;
}

export function LessonEditor({ lessonId, subjectId, subjectTitle }: LessonEditorProps) {
  const router = useRouter();
  const isEditing = !!lessonId;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [loading, setLoading] = useState(!!lessonId);
  const [saving, setSaving] = useState(false);

  // Lesson metadata
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [estimatedMinutes, setEstimatedMinutes] = useState("");
  const [status, setStatus] = useState("draft");
  const [currentSubjectId, setCurrentSubjectId] = useState(subjectId || "");

  // Markdown content
  const [markdown, setMarkdown] = useState("");
  const [quizQuestions, setQuizQuestions] = useState<LessonQuizQuestion[]>([]);
  const [ankiDeckRef, setAnkiDeckRef] = useState("");

  // Preview
  const [showPreview, setShowPreview] = useState(false);
  const [previewImages, setPreviewImages] = useState<
    { id: string; url: string; alt_text: string | null }[]
  >([]);

  // Picker dialogs
  const [imagePickerOpen, setImagePickerOpen] = useState(false);
  const [sequencePickerOpen, setSequencePickerOpen] = useState(false);

  // Load existing lesson
  useEffect(() => {
    if (!lessonId) return;
    async function load() {
      try {
        const data = await adminLearnService.getLesson(lessonId!);
        setTitle(data.title);
        setSlug(data.slug);
        setDescription(data.description || "");
        setEstimatedMinutes(data.estimated_minutes?.toString() || "");
        setStatus(data.status);
        setCurrentSubjectId(data.subject_id);

        // Prefer markdown content, fall back to legacy JSON
        if (data.content_markdown) {
          setMarkdown(data.content_markdown);
        }
        // Quiz: prefer dedicated column, fall back to embedded
        const quiz = data.quiz || (data.content as LessonContent)?.quiz;
        if (quiz?.questions) setQuizQuestions(quiz.questions);
        // Anki: prefer dedicated column, fall back to embedded
        const anki = data.anki_deck_ref || (data.content as LessonContent)?.ankiDeckRef;
        if (anki) setAnkiDeckRef(anki);
      } catch (err) {
        console.error("Failed to load lesson:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [lessonId]);

  // Load preview images when switching to preview mode
  useEffect(() => {
    if (!showPreview || !markdown) return;
    async function loadImages() {
      const ids = extractImageIds(markdown);
      if (ids.length === 0) {
        setPreviewImages([]);
        return;
      }
      try {
        const res = await fetch(`/api/admin/library/images?ids=${ids.join(",")}`);
        if (res.ok) {
          const data = await res.json();
          setPreviewImages(Array.isArray(data) ? data : data.images || []);
        }
      } catch {
        // Non-critical
      }
    }
    loadImages();
  }, [showPreview, markdown]);

  const generateSlug = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleSave = async () => {
    if (!title || !slug || !currentSubjectId) return;
    try {
      setSaving(true);
      const quiz: LessonQuiz | null =
        quizQuestions.length > 0 ? { questions: quizQuestions } : null;

      const payload = {
        title,
        slug,
        description: description || null,
        estimated_minutes: estimatedMinutes ? parseInt(estimatedMinutes) : null,
        status: status as Lesson["status"],
        content_markdown: markdown || null,
        quiz,
        anki_deck_ref: ankiDeckRef || null,
      };

      if (isEditing) {
        await adminLearnService.updateLesson(lessonId!, payload);
      } else {
        await adminLearnService.createLesson({
          subject_id: currentSubjectId,
          ...payload,
        });
      }
      router.push("/admin/learn");
    } catch (err) {
      console.error("Failed to save:", err);
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // Toolbar actions
  const insertText = (text: string, selectStart?: number, selectEnd?: number) => {
    if (!textareaRef.current) return;
    setMarkdown(insertAtCursor(textareaRef.current, text, selectStart, selectEnd));
  };

  const handleImageSelect = (imageIds: string[]) => {
    if (imageIds.length === 0) return;
    insertText(`\n:::image[${imageIds.join(",")}]\n`);
  };

  const handleSequenceSelect = (sequenceId: string) => {
    insertText(`\n:::explainer[${sequenceId}]\n`);
  };

  const toolbarActions = [
    {
      icon: Heading2,
      label: "Heading",
      action: () => insertText("\n## ", 4),
    },
    {
      icon: Bold,
      label: "Bold",
      action: () => insertText("**text**", 2, 6),
    },
    {
      icon: Italic,
      label: "Italic",
      action: () => insertText("*text*", 1, 5),
    },
    {
      icon: List,
      label: "List",
      action: () => insertText("\n- "),
    },
    {
      icon: Quote,
      label: "Blockquote",
      action: () => insertText("\n> "),
    },
    {
      icon: Minus,
      label: "Divider",
      action: () => insertText("\n---\n"),
    },
    { type: "separator" as const },
    {
      icon: Table2,
      label: "Table",
      action: () =>
        insertText(
          "\n| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n"
        ),
    },
    {
      icon: ImageIcon,
      label: "Image",
      action: () => setImagePickerOpen(true),
    },
    {
      icon: Play,
      label: "Explainer",
      action: () => setSequencePickerOpen(true),
    },
    {
      icon: Lightbulb,
      label: "Key Points",
      action: () =>
        insertText("\n:::key-points\n- Point one\n- Point two\n- Point three\n:::\n"),
    },
  ];

  // Quiz management
  const addQuizQuestion = () => {
    setQuizQuestions([
      ...quizQuestions,
      {
        id: crypto.randomUUID(),
        stem: "",
        options: [
          { id: "a", text: "" },
          { id: "b", text: "" },
          { id: "c", text: "" },
          { id: "d", text: "" },
        ],
        correctOptionId: "a",
        explanation: "",
      },
    ]);
  };

  const updateQuizQuestion = (index: number, updated: LessonQuizQuestion) => {
    const copy = [...quizQuestions];
    copy[index] = updated;
    setQuizQuestions(copy);
  };

  const removeQuizQuestion = (index: number) => {
    setQuizQuestions(quizQuestions.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/learn">
            <Button variant="ghost" size="sm" className="-ml-2 mb-1">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to modules
            </Button>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEditing ? "Edit Lesson" : "Create Lesson"}
          </h1>
          {subjectTitle && (
            <p className="text-muted-foreground">Subject: {subjectTitle}</p>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving || !title || !slug}>
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Lesson Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!isEditing) setSlug(generateSlug(e.target.value));
                }}
                placeholder="e.g., Solid Papillary Carcinoma"
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="solid-papillary-carcinoma"
              />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the lesson"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Estimated Minutes</Label>
              <Input
                type="number"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
                placeholder="10"
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Markdown Content */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Content</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
            >
              {showPreview ? (
                <>
                  <Edit3 className="mr-1 h-3 w-3" /> Edit
                </>
              ) : (
                <>
                  <Eye className="mr-1 h-3 w-3" /> Preview
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showPreview ? (
            <div className="min-h-[400px] rounded-lg border p-6">
              {markdown ? (
                <MarkdownLessonRenderer
                  markdown={markdown}
                  images={previewImages}
                />
              ) : (
                <p className="text-muted-foreground text-center py-12">
                  No content yet. Switch to edit mode to start writing.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {/* Toolbar */}
              <TooltipProvider delayDuration={300}>
                <div className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-muted/50 p-1">
                  {toolbarActions.map((action, i) => {
                    if ("type" in action && action.type === "separator") {
                      return (
                        <div
                          key={i}
                          className="mx-1 h-6 w-px bg-border"
                        />
                      );
                    }
                    const Icon = action.icon!;
                    return (
                      <Tooltip key={i}>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={action.action}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                          <p>{action.label}</p>
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>

              {/* Textarea */}
              <Textarea
                ref={textareaRef}
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
                placeholder={`Write your lesson content in Markdown...

## Section Heading

Regular text with **bold** and *italic*.

| Feature | Type A | Type B |
|---------|--------|--------|
| Size    | Small  | Large  |

Use the toolbar to insert images, explainers, and key points.`}
                className="min-h-[400px] font-mono text-sm leading-relaxed resize-y"
              />
              <p className="text-xs text-muted-foreground">
                Supports Markdown with tables, lists, and custom directives for images, explainers, and key points.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quiz */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Quiz Questions</CardTitle>
            <Button variant="outline" size="sm" onClick={addQuizQuestion}>
              <Plus className="mr-1 h-3 w-3" /> Add Question
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {quizQuestions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No quiz questions. Add questions for an end-of-lesson knowledge check.
            </p>
          )}
          {quizQuestions.map((q, index) => (
            <QuizQuestionForm
              key={q.id}
              question={q}
              index={index}
              onChange={(updated) => updateQuizQuestion(index, updated)}
              onRemove={() => removeQuizQuestion(index)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Anki Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Anki Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <Label>Anki Deck Name (optional)</Label>
          <Input
            value={ankiDeckRef}
            onChange={(e) => setAnkiDeckRef(e.target.value)}
            placeholder="e.g., Ankoma - AP::Breast"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Links to the matching deck in the Ankoma Deck Viewer
          </p>
        </CardContent>
      </Card>

      {/* Picker Dialogs */}
      <ImagePickerDialog
        open={imagePickerOpen}
        onOpenChange={setImagePickerOpen}
        onSelect={handleImageSelect}
      />
      <SequencePickerDialog
        open={sequencePickerOpen}
        onOpenChange={setSequencePickerOpen}
        onSelect={handleSequenceSelect}
      />
    </div>
  );
}

function QuizQuestionForm({
  question,
  index,
  onChange,
  onRemove,
}: {
  question: LessonQuizQuestion;
  index: number;
  onChange: (q: LessonQuizQuestion) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Question {index + 1}</span>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <div>
        <Label>Question Stem</Label>
        <Textarea
          value={question.stem}
          onChange={(e) => onChange({ ...question, stem: e.target.value })}
          placeholder="What is the question?"
        />
      </div>
      <div className="space-y-2">
        <Label>Options</Label>
        {question.options.map((opt, i) => (
          <div key={opt.id} className="flex items-center gap-2">
            <input
              type="radio"
              name={`correct-${question.id}`}
              checked={question.correctOptionId === opt.id}
              onChange={() => onChange({ ...question, correctOptionId: opt.id })}
              className="shrink-0"
            />
            <Input
              value={opt.text}
              onChange={(e) => {
                const options = [...question.options];
                options[i] = { ...opt, text: e.target.value };
                onChange({ ...question, options });
              }}
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
              className="flex-1"
            />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Select the radio button next to the correct answer
        </p>
      </div>
      <div>
        <Label>Explanation</Label>
        <Textarea
          value={question.explanation}
          onChange={(e) => onChange({ ...question, explanation: e.target.value })}
          placeholder="Explain why this answer is correct"
        />
      </div>
    </div>
  );
}
