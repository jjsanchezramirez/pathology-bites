"use client";

import { diffWords } from "diff";
import { Check, ImagePlus, ImageMinus } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";

interface QuestionOption {
  id?: string;
  text: string;
  is_correct: boolean;
  explanation?: string;
  order_index?: number;
}

interface QuestionImage {
  image_id: string;
  question_section: "stem" | "explanation";
  order_index?: number;
}

interface QuestionSnapshot {
  title?: string;
  stem?: string;
  difficulty?: string;
  teaching_point?: string;
  question_references?: string;
  answer_options?: QuestionOption[];
  question_options?: QuestionOption[];
  question_images?: QuestionImage[];
}

interface QuestionVersion {
  id: string;
  question_id: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
  version_string: string;
  update_type: string;
  change_summary?: string;
  question_snapshot: QuestionSnapshot;
  created_by: string;
  created_at: string;
  is_current?: boolean;
  creator?: {
    first_name: string;
    last_name: string;
  };
}

interface VersionComparisonViewProps {
  currentVersion: QuestionVersion;
  previousVersion: QuestionVersion;
}

// Component to render diff highlighting
function DiffText({ oldText, newText }: { oldText: string; newText: string }) {
  const diff = diffWords(oldText || "", newText || "");

  return (
    <div className="space-y-1">
      {/* Previous version with removals highlighted */}
      <div className="text-sm leading-relaxed">
        {diff.map((part, index) => {
          if (part.removed) {
            return (
              <span key={index} className="bg-red-100 dark:bg-red-950/50 text-red-900 dark:text-red-200 line-through">
                {part.value}
              </span>
            );
          }
          if (!part.added) {
            return <span key={index} className="text-muted-foreground">{part.value}</span>;
          }
          return null;
        })}
      </div>
      {/* Current version with additions highlighted */}
      <div className="text-sm leading-relaxed">
        {diff.map((part, index) => {
          if (part.added) {
            return (
              <span key={index} className="bg-green-100 dark:bg-green-950/50 text-green-900 dark:text-green-200 font-medium">
                {part.value}
              </span>
            );
          }
          if (!part.removed) {
            return <span key={index}>{part.value}</span>;
          }
          return null;
        })}
      </div>
    </div>
  );
}

// Simple component to show answer options side by side
function AnswerOptionsDiff({ oldOptions, newOptions }: { oldOptions: QuestionOption[]; newOptions: QuestionOption[] }) {
  const optionLabels = ["A", "B", "C", "D", "E"];

  // Determine max length for iteration
  const maxLength = Math.max(oldOptions.length, newOptions.length);

  return (
    <div className="space-y-3">
      {Array.from({ length: maxLength }).map((_, index) => {
        const oldOption = oldOptions[index];
        const newOption = newOptions[index];
        const optionLabel = optionLabels[index] || (index + 1).toString();

        // Check if option was added or removed
        const wasRemoved = oldOption && !newOption;
        const wasAdded = !oldOption && newOption;
        const changed = oldOption && newOption && (
          oldOption.text !== newOption.text ||
          oldOption.is_correct !== newOption.is_correct
        );

        if (!oldOption && !newOption) return null;

        return (
          <div key={index} className="space-y-1">
            {/* Previous version */}
            {oldOption && (
              <div className={`p-2 rounded-md border text-xs ${
                wasRemoved
                  ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 opacity-70"
                  : oldOption.is_correct
                    ? "bg-green-50/50 dark:bg-green-950/20 border-green-300/50 dark:border-green-800/50"
                    : "border-muted"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full border text-xs">
                    {optionLabel}
                  </span>
                  <span className={`flex-1 ${wasRemoved ? 'line-through' : ''}`}>{oldOption.text}</span>
                  {oldOption.is_correct && <Check className="w-3 h-3 text-green-500" />}
                </div>
              </div>
            )}

            {/* Current version */}
            {newOption && (
              <div className={`p-2 rounded-md border text-xs ${
                wasAdded
                  ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800"
                  : changed
                    ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800"
                    : newOption.is_correct
                      ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800"
                      : "border-muted"
              }`}>
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full border text-xs">
                    {optionLabel}
                  </span>
                  <span className="flex-1 font-medium">{newOption.text}</span>
                  {newOption.is_correct && <Check className="w-3 h-3 text-green-500" />}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Detect image changes
function getImageChanges(oldImages: QuestionImage[], newImages: QuestionImage[]) {
  const oldCount = oldImages?.length || 0;
  const newCount = newImages?.length || 0;
  const diff = newCount - oldCount;

  return {
    added: diff > 0 ? diff : 0,
    removed: diff < 0 ? Math.abs(diff) : 0,
    changed: diff !== 0,
  };
}

export function VersionComparisonView({
  currentVersion,
  previousVersion,
}: VersionComparisonViewProps) {
  const oldData = previousVersion.question_snapshot || {};
  const newData = currentVersion.question_snapshot || {};

  // Extract data
  const oldOptions = oldData.answer_options || oldData.question_options || [];
  const newOptions = newData.answer_options || newData.question_options || [];

  const oldStemImages = (oldData.question_images || []).filter((qi) => qi.question_section === "stem");
  const newStemImages = (newData.question_images || []).filter((qi) => qi.question_section === "stem");

  const oldExplanationImages = (oldData.question_images || []).filter((qi) => qi.question_section === "explanation");
  const newExplanationImages = (newData.question_images || []).filter((qi) => qi.question_section === "explanation");

  const stemImageChanges = getImageChanges(oldStemImages, newStemImages);
  const explanationImageChanges = getImageChanges(oldExplanationImages, newExplanationImages);

  // Check what changed
  const titleChanged = oldData.title !== newData.title;
  const stemChanged = oldData.stem !== newData.stem;
  const difficultyChanged = oldData.difficulty !== newData.difficulty;
  const teachingPointChanged = oldData.teaching_point !== newData.teaching_point;
  const referencesChanged = oldData.question_references !== newData.question_references;
  const optionsChanged = JSON.stringify(oldOptions) !== JSON.stringify(newOptions);

  return (
    <div className="space-y-6">
      {/* Change Summary */}
      {currentVersion.change_summary && (
        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
          <h3 className="font-medium text-sm mb-2">Change Summary</h3>
          <p className="text-sm text-muted-foreground">{currentVersion.change_summary}</p>
        </div>
      )}

      {/* Version Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            Comparing <Badge variant="outline" className="ml-1">{previousVersion.version_string}</Badge>
          </span>
          <span>→</span>
          <span>
            <Badge variant="outline">{currentVersion.version_string}</Badge>
          </span>
        </div>
        <div>
          {new Date(currentVersion.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: Previous Version */}
        <div className="space-y-4 border-r pr-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <h4 className="font-medium text-sm">Previous ({previousVersion.version_string})</h4>
          </div>

          <div className="space-y-4 text-sm opacity-80">
            {/* Title */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1 uppercase">Title</div>
              <div className={titleChanged ? "text-red-600 dark:text-red-400 line-through" : ""}>
                {oldData.title || "No title"}
              </div>
            </div>

            {/* Stem */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1 uppercase">Question</div>
              <div className={stemChanged ? "text-red-600 dark:text-red-400" : ""}>
                {oldData.stem || "No question stem"}
              </div>
            </div>

            {/* Stem Images */}
            {stemImageChanges.changed && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ImageMinus className="h-3 w-3" />
                <span>{oldStemImages.length} image{oldStemImages.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* Answer Options */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase">Answer Options</div>
              <div className="space-y-2">
                {oldOptions.map((option, index: number) => {
                  const optionLabels = ["A", "B", "C", "D", "E"];
                  const optionLabel = optionLabels[index] || (index + 1).toString();

                  return (
                    <div
                      key={option.id || index}
                      className={`p-2 rounded-md border text-xs ${
                        option.is_correct
                          ? "bg-green-50/50 dark:bg-green-950/20 border-green-300/50 dark:border-green-800/50"
                          : "border-muted"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-4 h-4 rounded-full border text-xs">
                          {optionLabel}
                        </span>
                        <span className="flex-1">{option.text}</span>
                        {option.is_correct && <Check className="w-3 h-3 text-green-500" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Teaching Point */}
            {(oldData.teaching_point || teachingPointChanged) && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1 uppercase">Teaching Point</div>
                <div className={teachingPointChanged ? "text-red-600 dark:text-red-400" : ""}>
                  {oldData.teaching_point || "No teaching point"}
                </div>
              </div>
            )}

            {/* Explanation Images */}
            {explanationImageChanges.changed && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ImageMinus className="h-3 w-3" />
                <span>{oldExplanationImages.length} explanation image{oldExplanationImages.length !== 1 ? 's' : ''}</span>
              </div>
            )}

            {/* References */}
            {(oldData.question_references || referencesChanged) && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1 uppercase">References</div>
                <div className={referencesChanged ? "text-red-600 dark:text-red-400" : ""}>
                  {oldData.question_references || "No references"}
                </div>
              </div>
            )}

            {/* Difficulty */}
            <div className="pt-2 border-t">
              <Badge variant="outline" className={difficultyChanged ? "opacity-50" : ""}>
                {oldData.difficulty?.charAt(0).toUpperCase() + oldData.difficulty?.slice(1) || "Medium"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Right: Current Version with Diff */}
        <div className="space-y-4 pl-4">
          <div className="flex items-center gap-2 pb-2 border-b">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <h4 className="font-medium text-sm">Current ({currentVersion.version_string})</h4>
          </div>

          <div className="space-y-4 text-sm">
            {/* Title */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1 uppercase">Title</div>
              {titleChanged ? (
                <DiffText oldText={oldData.title || ""} newText={newData.title || ""} />
              ) : (
                <div>{newData.title || "No title"}</div>
              )}
            </div>

            {/* Stem */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1 uppercase">Question</div>
              {stemChanged ? (
                <DiffText oldText={oldData.stem || ""} newText={newData.stem || ""} />
              ) : (
                <div>{newData.stem || "No question stem"}</div>
              )}
            </div>

            {/* Stem Images */}
            {stemImageChanges.changed && (
              <div className="bg-muted/50 border rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs">
                  {stemImageChanges.added > 0 && (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <ImagePlus className="h-3 w-3" />
                      <span>+{stemImageChanges.added} image{stemImageChanges.added !== 1 ? 's' : ''} added</span>
                    </div>
                  )}
                  {stemImageChanges.removed > 0 && (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <ImageMinus className="h-3 w-3" />
                      <span>-{stemImageChanges.removed} image{stemImageChanges.removed !== 1 ? 's' : ''} removed</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Total: {newStemImages.length} image{newStemImages.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {/* Answer Options */}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2 uppercase">Answer Options</div>
              {optionsChanged ? (
                <AnswerOptionsDiff oldOptions={oldOptions} newOptions={newOptions} />
              ) : (
                <div className="space-y-2">
                  {newOptions.map((option, index: number) => {
                    const optionLabels = ["A", "B", "C", "D", "E"];
                    const optionLabel = optionLabels[index] || (index + 1).toString();

                    return (
                      <div
                        key={option.id || index}
                        className={`p-2 rounded-md border text-xs ${
                          option.is_correct
                            ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800"
                            : "border-muted"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-4 h-4 rounded-full border text-xs">
                            {optionLabel}
                          </span>
                          <span className="flex-1">{option.text}</span>
                          {option.is_correct && <Check className="w-3 h-3 text-green-500" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Teaching Point */}
            {(newData.teaching_point || teachingPointChanged) && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1 uppercase">Teaching Point</div>
                {teachingPointChanged ? (
                  <DiffText oldText={oldData.teaching_point || ""} newText={newData.teaching_point || ""} />
                ) : (
                  <div>{newData.teaching_point || "No teaching point"}</div>
                )}
              </div>
            )}

            {/* Explanation Images */}
            {explanationImageChanges.changed && (
              <div className="bg-muted/50 border rounded-lg p-3">
                <div className="flex items-center gap-2 text-xs">
                  {explanationImageChanges.added > 0 && (
                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                      <ImagePlus className="h-3 w-3" />
                      <span>+{explanationImageChanges.added} image{explanationImageChanges.added !== 1 ? 's' : ''} added</span>
                    </div>
                  )}
                  {explanationImageChanges.removed > 0 && (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <ImageMinus className="h-3 w-3" />
                      <span>-{explanationImageChanges.removed} image{explanationImageChanges.removed !== 1 ? 's' : ''} removed</span>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Total: {newExplanationImages.length} image{newExplanationImages.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}

            {/* References */}
            {(newData.question_references || referencesChanged) && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1 uppercase">References</div>
                {referencesChanged ? (
                  <DiffText oldText={oldData.question_references || ""} newText={newData.question_references || ""} />
                ) : (
                  <div>{newData.question_references || "No references"}</div>
                )}
              </div>
            )}

            {/* Difficulty */}
            <div className="pt-2 border-t">
              <Badge variant={difficultyChanged ? "default" : "outline"}>
                {newData.difficulty?.charAt(0).toUpperCase() + newData.difficulty?.slice(1) || "Medium"}
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
