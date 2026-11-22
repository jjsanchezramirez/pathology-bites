"use client";

import { useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { BookOpen } from "lucide-react";

/**
 * What the question writer is about: the labels the AI question, refinement and
 * audio-script prompts are built from. Since 2026-11-21 this is typed by the
 * author, not picked from scraped third-party lesson files — those (PathPrimer,
 * ExpertPath) now live only in the private R2 bucket and the app never reads them.
 */
export interface EducationalContent {
  category: string;
  subject: string;
  lesson: string;
  topic: string;
}

// ABPath-style subject list, grouped by category. Labels only — no file behind them.
const SUBJECTS: Record<string, string[]> = {
  "Anatomic Pathology": [
    "Bone",
    "Breast",
    "Cardiovascular and Thoracic",
    "Cytopathology",
    "Dermatopathology",
    "Forensics and Autopsy",
    "Gastrointestinal",
    "General Topics",
    "Genitourinary",
    "Gynecological",
    "Head and Neck / Endocrine",
    "Hematopathology",
    "Molecular",
    "Neuropathology",
    "Pancreas Biliary Liver",
    "Pediatrics",
    "Soft Tissue",
  ],
  "Clinical Pathology": [
    "Clinical Chemistry",
    "Hematology Hemostasis and Thrombosis",
    "Hematopathology",
    "Immunology",
    "Laboratory Management and Clinical Laboratory Informatics",
    "Medical Microbiology",
    "Molecular Pathology and Cytogenetics",
    "Toxicology Body Fluids and Special Techniques",
    "Transfusion Medicine",
  ],
};

const SEP = "::";

interface ContentSelectorProps {
  onContentSelect: (content: EducationalContent) => void;
  selectedContent: EducationalContent | null;
}

export function ContentSelector({ onContentSelect, selectedContent }: ContentSelectorProps) {
  const [subjectKey, setSubjectKey] = useState(
    selectedContent ? `${selectedContent.category}${SEP}${selectedContent.subject}` : ""
  );
  const [lesson, setLesson] = useState(selectedContent?.lesson ?? "");
  const [topic, setTopic] = useState(selectedContent?.topic ?? "");

  // Report a selection once all four labels are filled, and only when it changed.
  useEffect(() => {
    if (!subjectKey || !lesson.trim() || !topic.trim()) return;
    const [category, subject] = subjectKey.split(SEP);
    const next = { category, subject, lesson: lesson.trim(), topic: topic.trim() };
    if (
      selectedContent &&
      selectedContent.category === next.category &&
      selectedContent.subject === next.subject &&
      selectedContent.lesson === next.lesson &&
      selectedContent.topic === next.topic
    ) {
      return;
    }
    onContentSelect(next);
  }, [subjectKey, lesson, topic, selectedContent, onContentSelect]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Category & Subject</label>
        <Select value={subjectKey} onValueChange={setSubjectKey}>
          <SelectTrigger>
            <SelectValue placeholder="Select a subject..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SUBJECTS).map(([category, subjects]) => (
              <div key={category}>
                <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">
                  {category}
                </div>
                {subjects.map((subject) => (
                  <SelectItem
                    key={`${category}${SEP}${subject}`}
                    value={`${category}${SEP}${subject}`}
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      {subject}
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="content-lesson" className="text-sm font-medium">
            Lesson
          </label>
          <Input
            id="content-lesson"
            placeholder="e.g., Bone-Forming Tumors"
            value={lesson}
            onChange={(e) => setLesson(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="content-topic" className="text-sm font-medium">
            Topic
          </label>
          <Input
            id="content-topic"
            placeholder="e.g., Osteoid Osteoma"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}
