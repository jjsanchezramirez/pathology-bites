"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { adminLearnService } from "../services/admin-learn-service";
import { LearningSubject } from "@/features/user/learn/types/lesson";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
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
import { Plus, Loader2, Pencil, Trash2, BookOpen, ExternalLink } from "lucide-react";

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
      console.error("Failed to load:", err);
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
      console.error("Failed to save:", err);
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
      console.error("Failed to delete:", err);
    }
  };

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Learning Modules</h1>
          <p className="text-muted-foreground mt-1">Manage subjects and lessons</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Subject
            </Button>
          </DialogTrigger>
          <DialogContent>
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
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : subjects.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No subjects yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first subject to start building learning modules.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => (
            <Card key={subject.id}>
              <CardHeader className="p-4 pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{subject.title}</CardTitle>
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
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(subject)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(subject.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>{subject.category?.name}</span>
                    <span>{subject.lesson_count} lessons</span>
                    {subject.description && (
                      <span className="truncate max-w-[300px]">{subject.description}</span>
                    )}
                  </div>
                  <Link
                    href={`/admin/learn/lessons/create?subject_id=${subject.id}&subject_title=${encodeURIComponent(subject.title)}`}
                  >
                    <Button variant="outline" size="sm">
                      <Plus className="mr-1 h-3 w-3" />
                      Add Lesson
                    </Button>
                  </Link>
                </div>
                {/* Lesson list */}
                {subject.lesson_count > 0 && <LessonList subjectId={subject.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
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
    <div className="mt-3 space-y-1 border-t pt-3">
      {lessons.map((lesson) => (
        <div key={lesson.id} className="flex items-center justify-between py-1 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{lesson.sort_order + 1}.</span>
            <span>{lesson.title}</span>
            <Badge variant="outline" className="text-xs">
              {lesson.status}
            </Badge>
          </div>
          <Link href={`/admin/learn/lessons/${lesson.id}/edit`}>
            <Button variant="ghost" size="sm">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      ))}
    </div>
  );
}
