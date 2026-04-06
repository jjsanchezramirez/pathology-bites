"use client";

import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { ArrowLeft, Check, ChevronRight, BookOpen } from "lucide-react";
import { StudyResource } from "../lib/types";
import { RESOURCE_SWATCHES } from "../lib/color-utils";

function paceLabel(type: string): string {
  switch (type) {
    case "book": return "Pages/hr";
    case "qbank": return "Qs/hr";
    case "flashcards": return "Cards/hr";
    case "video": return "Speed";
    default: return "Pace";
  }
}

interface ResourceEditPanelProps {
  initial: Partial<StudyResource>;
  onSave: (resource: StudyResource) => void;
  onBack: () => void;
  onDelete?: () => void;
  onEditSubjects: (form: Partial<StudyResource>) => void;
}

export function ResourceEditPanel({ initial, onSave, onBack, onDelete, onEditSubjects }: ResourceEditPanelProps) {
  const [form, setForm] = useState<Partial<StudyResource>>({ ...initial });

  const resType = form.type || "book";
  const isNew = !initial.name;
  const subjects = form.subjects || [];
  const activeCount = subjects.filter(s => s.active !== false).length;

  const toggleSubject = (idx: number) => {
    const updated = [...subjects];
    updated[idx] = { ...updated[idx], active: updated[idx].active === false ? true : false };
    setForm({ ...form, subjects: updated });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={18} />
        </Button>
        <span className="flex-1 text-sm font-semibold text-foreground">
          {isNew ? "New Resource" : form.name || "Edit Resource"}
        </span>
        {onDelete && !isNew && (
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
            onClick={() => { if (confirm(`Remove ${form.name}?`)) onDelete(); }}>
            Remove
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Name</label>
            <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Short</label>
            <Input value={form.short_name || ""} onChange={(e) => setForm({ ...form, short_name: e.target.value })} placeholder="QCCP" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Type</label>
            <select value={resType}
              onChange={(e) => {
                const t = e.target.value as StudyResource["type"];
                const p = t === "book" ? 10 : t === "video" ? 1.25 : t === "qbank" ? 20 : 50;
                setForm({ ...form, type: t, pace: p });
              }}
              className="h-8 w-full rounded-xl border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">
              <option value="book">Book</option>
              <option value="video">Video</option>
              <option value="qbank">QBank</option>
              <option value="flashcards">Flashcards</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">{paceLabel(resType)}</label>
            <Input type="text" inputMode="decimal"
              value={form.pace ?? (resType === "video" ? 1.25 : 10)}
              onChange={(e) => { const v = e.target.value; if (v === "" || /^\d*\.?\d*$/.test(v)) setForm({ ...form, pace: parseFloat(v) || 0 }); }} />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs text-muted-foreground">Color</label>
          <div className="flex gap-1">
            {RESOURCE_SWATCHES.map((c) => (
              <button key={c} onClick={() => setForm({ ...form, color: c })}
                className={`size-7 shrink-0 rounded-full border-2 transition-all ${form.color === c ? "border-foreground/60 shadow-sm" : "border-border hover:scale-110"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-xs text-muted-foreground">Subjects ({activeCount}/{subjects.length})</label>
          </div>

          <button onClick={() => onEditSubjects(form)}
            className="mb-2 flex w-full items-center gap-3 rounded-xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/50">
            <BookOpen size={16} className="text-muted-foreground" />
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">Edit Subjects</div>
              <div className="text-xs text-muted-foreground">Add, remove, or edit details</div>
            </div>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>

          {subjects.length > 0 && (
            <div className="rounded-xl border border-border divide-y divide-border">
              {subjects.map((subj, idx) => (
                <button key={idx} onClick={() => toggleSubject(idx)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted/30 ${subj.active === false ? "opacity-40" : ""}`}>
                  <div className={`flex size-4 shrink-0 items-center justify-center rounded border ${subj.active !== false ? "border-primary bg-primary" : "border-muted-foreground/30"}`}>
                    {subj.active !== false && <Check size={10} className="text-primary-foreground" strokeWidth={3} />}
                  </div>
                  <span className="flex-1 truncate text-sm text-foreground">{subj.name || "Unnamed"}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{subj.content_amount || 0}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border px-4 py-3">
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => onSave(form as StudyResource)}>
            <Check size={14} /> Save
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onBack}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
