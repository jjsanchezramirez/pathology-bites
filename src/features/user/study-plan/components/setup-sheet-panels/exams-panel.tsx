"use client";

import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Plus, X } from "lucide-react";
import { PanelHeader } from "../setup-sheet-parts";

type ExamDate = { name: string; date: string };

export function ExamsPanel({
  examDates,
  onChange,
  onBack,
}: {
  examDates: ExamDate[];
  onChange: (exams: ExamDate[]) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <PanelHeader title="Exam Dates" onBack={onBack} />
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {examDates.map((exam, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={exam.name}
              onChange={(e) => {
                const exams = [...examDates];
                exams[idx] = { ...exams[idx], name: e.target.value };
                onChange(exams);
              }}
              placeholder="Exam name"
              className="flex-1"
            />
            <Input
              type="date"
              value={exam.date}
              onChange={(e) => {
                const exams = [...examDates];
                exams[idx] = { ...exams[idx], date: e.target.value };
                onChange(exams);
              }}
              className="w-[140px]"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange(examDates.filter((_, i) => i !== idx))}
            >
              <X size={14} className="text-muted-foreground" />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...examDates, { name: "", date: "" }])}
        >
          <Plus size={14} /> Add Exam
        </Button>
      </div>
    </div>
  );
}
