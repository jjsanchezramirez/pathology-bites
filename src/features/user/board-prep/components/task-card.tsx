"use client";

import { Check, Clock, BookMarked, Play, FileQuestion, SwatchBook, Bird, Flower, Rabbit, GraduationCap } from "lucide-react";
import { ScheduleTask } from "../lib/types";

const TYPE_ICONS: Record<string, { icon: typeof BookMarked; label: string }> = {
  book: { icon: BookMarked, label: "Book" },
  video: { icon: Play, label: "Video" },
  qbank: { icon: FileQuestion, label: "Q-Bank" },
  flashcards: { icon: SwatchBook, label: "Flashcards" },
};

interface TaskCardProps {
  task: ScheduleTask;
  completed: boolean;
  colorBg: string;
  colorText: string;
  onToggle: () => void;
  isPreExam?: boolean;
  shortName?: string;
}

function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function getTypeFromVerb(verb: string): string | null {
  switch (verb) {
    case "Read": return "book";
    case "Watch": return "video";
    case "Do": return "qbank";
    case "Review": return "flashcards";
    default: return null;
  }
}

export function TaskCard({ task, completed, colorBg, colorText, onToggle, isPreExam, shortName }: TaskCardProps) {
  if (task.task_type === "rest" && isPreExam) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-blue-50 px-4 py-3.5 dark:bg-blue-950/30">
        <Flower size={18} className="shrink-0 text-blue-500" />
        <div className="text-sm font-bold text-blue-600 dark:text-blue-300">Rest, review, relax</div>
      </div>
    );
  }

  if (task.task_type === "rest") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-green-50 px-4 py-3.5 dark:bg-green-950/30">
        <Rabbit size={18} className="shrink-0 text-green-600" />
        <div className="text-sm font-bold text-green-700 dark:text-green-300">Catch up day</div>
      </div>
    );
  }

  if (task.task_type === "exam") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-purple-50 px-4 py-3.5 dark:bg-purple-950/30">
        <GraduationCap size={18} className="shrink-0 text-purple-600" />
        <div>
          <div className="text-sm font-bold text-purple-700 dark:text-purple-300">{task.activity || "Exam Day"}</div>
        </div>
      </div>
    );
  }

  if (task.task_type === "gone") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-red-50 px-4 py-3.5 dark:bg-red-950/30">
        <Bird size={18} className="shrink-0 text-red-400" />
        <div className="text-sm font-bold text-red-400 dark:text-red-300">Enjoy your day off!</div>
      </div>
    );
  }

  const verb = task.activity.split(" ")[0];
  const type = getTypeFromVerb(verb);
  const entry = type ? TYPE_ICONS[type] : null;
  const displayName = shortName || task.resource_name;

  return (
    <button
      onClick={onToggle}
      className={`group w-full rounded-2xl border border-border/60 bg-card px-3.5 py-2.5 text-left transition-all hover:shadow-sm hover:border-border active:scale-[0.99] ${
        completed ? "opacity-45" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm"
          style={{ backgroundColor: colorBg, color: colorText }}
        >
          {entry ? (
            <entry.icon size={18} strokeWidth={2.5} />
          ) : (
            <span className="text-sm font-bold">{task.resource_name.charAt(0)}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className={`text-sm font-medium leading-tight text-foreground ${completed ? "line-through decoration-muted-foreground/40" : ""}`}>
            {task.subject || task.resource_name}
          </div>

          {/* Mobile */}
          <div className="lg:hidden">
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="truncate">{displayName}</span>
              {entry?.label && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="shrink-0">{entry.label}</span>
                </>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs">
              {task.content_label && (
                <span className="text-foreground/50">{task.content_label}</span>
              )}
              <span className="flex items-center gap-0.5 tabular-nums text-muted-foreground">
                <Clock size={10} />
                {fmtTime(task.minutes)}
              </span>
            </div>
          </div>

          {/* Desktop */}
          <div className="mt-0.5 hidden items-center gap-1.5 text-xs text-muted-foreground lg:flex">
            <span className="truncate">{task.resource_name}</span>
            {entry?.label && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="shrink-0">{entry.label}</span>
              </>
            )}
            {task.content_label && (
              <>
                <span className="text-muted-foreground/30">·</span>
                <span className="text-foreground/50">{task.content_label}</span>
              </>
            )}
            <span className="flex items-center gap-0.5 tabular-nums">
              <Clock size={10} />
              {fmtTime(task.minutes)}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          {completed ? (
            <div className="flex size-6 items-center justify-center rounded-full bg-emerald-400 shadow-sm">
              <Check size={14} className="text-white" strokeWidth={3} />
            </div>
          ) : (
            <div className="flex size-6 items-center justify-center rounded-full border-2 border-muted-foreground/20 transition-colors group-hover:border-muted-foreground/40">
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
