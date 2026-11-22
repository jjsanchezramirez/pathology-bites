"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { adminLearnService } from "../services/admin-learn-service";
import { LearningSubject } from "@/features/user/learn/types/lesson";
import { PageContainer, SectionCard } from "@/shared/components/ui/page-layout";
import { PageHeader } from "@/shared/components/ui/page-header";
import { EmptyState } from "@/shared/components/ui/empty-state";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Plus, Loader2, Pencil, Trash2, BookOpen, ExternalLink } from "lucide-react";
import { log } from "@/shared/utils/logging";

interface SubjectWithMeta extends LearningSubject {
  category: { id: string; name: string; color: string | null; short_form: string | null };
  lesson_count: number;
}

export function SubjectManager() {
  const [subjects, setSubjects] = useState<SubjectWithMeta[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectWithMeta | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("draft");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [subjectsData, catsRes] = await Promise.all([
        adminLearnService.getSubjects(),
        fetch("/api/admin/questions/metadata/categories?pageSize=200").then((r) => r.json()),
      ]);
      setSubjects(subjectsData);
      const catsList = catsRes?.categories || [];
      setCategories(
        catsList.map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }))
      );
    } catch (err) {
      log.error("Failed to load:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSlug("");
    setCategoryId("");
    setStatus("draft");
    setEditingSubject(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (subject: SubjectWithMeta) => {
    setEditingSubject(subject);
    setTitle(subject.title);
    setDescription(subject.description || "");
    setSlug(subject.slug);
    setCategoryId(subject.category_id);
    setStatus(subject.status);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !slug.trim() || !categoryId) return;
    try {
      setSaving(true);
      if (editingSubject) {
        await adminLearnService.updateSubject(editingSubject.id, {
          title,
          description: description || null,
          slug,
          category_id: categoryId,
          status: status as "draft" | "published" | "archived",
        });
      } else {
        await adminLearnService.createSubject({
          title,
          description: description || undefined,
          slug,
          category_id: categoryId,
          status,
        });
      }
      setDialogOpen(false);
      resetForm();
      await load();
    } catch (err) {
      log.error("Failed to save:", err);
      alert(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this subject and all its lessons?")) return;
    try {
      await adminLearnService.deleteSubject(id);
      await load();
    } catch (err) {
      log.error("Failed to delete:", err);
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return (
    <PageContainer>
      <PageHeader
        title="Learning Modules"
        description="Manage subjects and lessons"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New Subject
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingSubject ? "Edit Subject" : "Create Subject"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Title</Label>
                  <Input
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      if (!editingSubject) setSlug(generateSlug(e.target.value));
                    }}
                    placeholder="e.g., Papillary Breast Lesions"
                  />
                </div>
                <div>
                  <Label>Slug</Label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="papillary-breast-lesions"
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={categoryId} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave} disabled={saving || !title || !slug || !categoryId}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingSubject ? "Update" : "Create"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SectionCard key={i}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="flex items-center gap-1">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-4">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-4 w-40" />
                </div>
                <Skeleton className="h-8 w-28 rounded" />
              </div>
            </SectionCard>
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <SectionCard>
          <EmptyState
            icon={BookOpen}
            title="No subjects yet"
            description="Create your first subject to start building learning modules."
          />
        </SectionCard>
      ) : (
        <div className="space-y-4">
          {subjects.map((subject) => (
            <SectionCard
              key={subject.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 truncate">{subject.title}</span>
                  <Badge
                    variant={
                      subject.status === "published"
                        ? "default"
                        : subject.status === "archived"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {subject.status}
                  </Badge>
                </span>
              }
              actions={
                <>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(subject)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(subject.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              }
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
                  <span>{subject.category?.name}</span>
                  <span>{subject.lesson_count} lessons</span>
                  {subject.description && (
                    <span className="min-w-0 max-w-[300px] truncate">{subject.description}</span>
                  )}
                </div>
                <Link
                  href={`/admin/learn/lessons/create?subject_id=${subject.id}&subject_title=${encodeURIComponent(subject.title)}`}
                >
                  <Button variant="outline" size="sm">
                    <Plus className="mr-1 h-4 w-4" />
                    Add Lesson
                  </Button>
                </Link>
              </div>
              {/* Lesson list */}
              {subject.lesson_count > 0 && <LessonList subjectId={subject.id} />}
            </SectionCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function LessonList({ subjectId }: { subjectId: string }) {
  const [lessons, setLessons] = useState<
    { id: string; title: string; slug: string; status: string; sort_order: number }[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await adminLearnService.getLessons(subjectId);
        setLessons(
          data.map((l) => ({
            id: l.id,
            title: l.title,
            slug: l.slug,
            status: l.status,
            sort_order: l.sort_order,
          }))
        );
      } catch {
        // Non-critical
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subjectId]);

  if (loading) return null;
  if (lessons.length === 0) return null;

  return (
    <div className="space-y-1 border-t pt-4">
      {lessons.map((lesson) => (
        <div key={lesson.id} className="flex items-center justify-between gap-2 py-1 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-muted-foreground">{lesson.sort_order + 1}.</span>
            <span className="min-w-0 truncate">{lesson.title}</span>
            <Badge variant="outline" className="shrink-0 text-xs">
              {lesson.status}
            </Badge>
          </div>
          <Link href={`/admin/learn/lessons/${lesson.id}/edit`}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ))}
    </div>
  );
}
