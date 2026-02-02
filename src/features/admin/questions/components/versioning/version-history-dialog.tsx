"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Badge } from "@/shared/components/ui/badge";
import { History, User, Calendar, Check, ImagePlus, ImageMinus } from "lucide-react";
import { toast } from "@/shared/utils/ui/toast";
import { useProtectedDialog } from "@/shared/hooks/use-protected-dialog";
import { diffWords } from "diff";
import { formatVersion } from "@/shared/utils/version";

// Types
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
  question_options?: QuestionOption[];
  question_images?: QuestionImage[];
  lesson?: string;
  topic?: string;
  question_set_id?: string;
  category_id?: string;
  tag_ids?: string[];
}

interface QuestionVersion {
  id: string;
  question_id: string;
  version_major: number;
  version_minor: number;
  version_patch: number;
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

interface VersionHistoryDialogProps {
  questionId: string | null;
  questionTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Component to render diff highlighting
function DiffText({ oldText, newText }: { oldText: string; newText: string }) {
  const diff = diffWords(oldText || "", newText || "");

  return (
    <div className="text-sm leading-relaxed">
      {diff.map((part, index) => {
        if (part.removed) {
          return (
            <span
              key={index}
              className="bg-red-100 dark:bg-red-950/50 text-red-900 dark:text-red-200 line-through"
            >
              {part.value}
            </span>
          );
        }
        if (part.added) {
          return (
            <span
              key={index}
              className="bg-green-100 dark:bg-green-950/50 text-green-900 dark:text-green-200 font-medium"
            >
              {part.value}
            </span>
          );
        }
        return <span key={index}>{part.value}</span>;
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

// Format references with line breaks
function formatReferences(references: string) {
  if (!references) return references;

  // Split on common reference separators while preserving the separator
  // Look for patterns like: ". " followed by uppercase letter, or new URLs
  const parts = references.split(/(?<=\.\s)(?=[A-Z])|(?=https?:\/\/)/);

  return parts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n\n");
}

export function VersionHistoryDialog({
  questionId,
  questionTitle,
  open,
  onOpenChange,
}: VersionHistoryDialogProps) {
  const [versions, setVersions] = useState<QuestionVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number | null>(null);

  // Use protected dialog hook to prevent immediate closing
  const handleOpenChange = useProtectedDialog(open, onOpenChange);

  const fetchVersionHistory = async () => {
    if (!questionId) return;

    try {
      setLoading(true);

      const response = await fetch(`/api/admin/questions/${questionId}/version`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error:", response.status, errorText);
        toast.error(`Failed to load version history: ${response.status} ${response.statusText}`);
        return;
      }

      const result = await response.json();

      if (result.success && result.versions) {
        // Transform the API response to match our interface
        interface ApiVersion {
          id: string;
          version_major: number;
          version_minor: number;
          version_patch: number;
          update_type: string;
          change_summary?: string;
          question_data: QuestionSnapshot;
          changed_by: string;
          created_at: string;
          is_current?: boolean;
          changer?: { first_name: string; last_name: string };
        }

        const transformedVersions = result.versions.map((version: ApiVersion) => ({
          id: version.id,
          question_id: questionId,
          version_major: version.version_major,
          version_minor: version.version_minor,
          version_patch: version.version_patch,
          update_type: version.update_type,
          change_summary: version.change_summary,
          question_snapshot: version.question_data,
          created_by: version.changed_by,
          created_at: version.created_at,
          is_current: version.is_current,
          creator: version.changer,
        }));

        setVersions(transformedVersions);
        // Auto-select the first (most recent) version
        setSelectedVersionIndex(0);
      } else {
        setVersions([]);
        setSelectedVersionIndex(null);
      }
    } catch (error) {
      console.error("Error fetching version history:", error);
      toast.error(`Failed to load version history: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && questionId) {
      fetchVersionHistory();
    } else if (!open) {
      // Reset selection when dialog closes
      setSelectedVersionIndex(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, questionId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get selected version and previous version
  const selectedVersion = selectedVersionIndex !== null ? versions[selectedVersionIndex] : null;
  const previousVersion =
    selectedVersionIndex !== null && selectedVersionIndex < versions.length - 1
      ? versions[selectedVersionIndex + 1]
      : null;

  // Render version content
  const renderVersionContent = (
    version: QuestionVersion,
    showDiff: boolean = false,
    compareWith?: QuestionVersion
  ) => {
    const versionData = version.question_snapshot || {};
    const compareData = compareWith?.question_snapshot || {};

    const options = versionData.question_options || [];
    const compareOptions = compareData.question_options || [];

    const stemImages = (versionData.question_images || []).filter(
      (qi) => qi.question_section === "stem"
    );
    const explanationImages = (versionData.question_images || []).filter(
      (qi) => qi.question_section === "explanation"
    );

    const compareStemImages = (compareData.question_images || []).filter(
      (qi) => qi.question_section === "stem"
    );
    const compareExplanationImages = (compareData.question_images || []).filter(
      (qi) => qi.question_section === "explanation"
    );

    const stemImageChanges = compareWith ? getImageChanges(compareStemImages, stemImages) : null;
    const explanationImageChanges = compareWith
      ? getImageChanges(compareExplanationImages, explanationImages)
      : null;

    // Check what changed
    const titleChanged = showDiff && compareWith && compareData.title !== versionData.title;
    const stemChanged = showDiff && compareWith && compareData.stem !== versionData.stem;
    const difficultyChanged =
      showDiff && compareWith && compareData.difficulty !== versionData.difficulty;
    const teachingPointChanged =
      showDiff && compareWith && compareData.teaching_point !== versionData.teaching_point;
    const referencesChanged =
      showDiff &&
      compareWith &&
      compareData.question_references !== versionData.question_references;
    const optionsChanged =
      showDiff && compareWith && JSON.stringify(compareOptions) !== JSON.stringify(options);

    // Count total changes
    const hasChanges =
      titleChanged ||
      stemChanged ||
      difficultyChanged ||
      teachingPointChanged ||
      referencesChanged ||
      optionsChanged ||
      stemImageChanges?.changed ||
      explanationImageChanges?.changed;

    return (
      <div className="space-y-4 text-sm">
        {/* Show no changes indicator in diff mode */}
        {showDiff && compareWith && !hasChanges && (
          <div className="p-3 rounded-lg border bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800">
            <p className="text-xs font-medium text-red-900 dark:text-red-200">
              No changes detected between these versions
            </p>
          </div>
        )}

        {/* Title */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase">Title</div>
          {titleChanged && compareWith ? (
            <DiffText oldText={compareData.title || ""} newText={versionData.title || ""} />
          ) : (
            <div className="leading-relaxed">{versionData.title || "No title"}</div>
          )}
        </div>

        {/* Stem */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase">Question</div>
          {stemChanged && compareWith ? (
            <DiffText oldText={compareData.stem || ""} newText={versionData.stem || ""} />
          ) : (
            <div className="leading-relaxed">{versionData.stem || "No question stem"}</div>
          )}
        </div>

        {/* Stem Images */}
        {(stemImages.length > 0 || stemImageChanges?.changed) && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase">
              Stem Images
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from({ length: stemImages.length }).map((_, i) => (
                <div
                  key={i}
                  className="w-12 h-12 bg-muted border-2 border-dashed rounded flex items-center justify-center"
                >
                  <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                </div>
              ))}
              {stemImages.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No images</span>
              )}
            </div>
            {stemImageChanges?.changed && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {stemImageChanges.added > 0 && (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <ImagePlus className="h-3 w-3" />
                    <span>+{stemImageChanges.added}</span>
                  </div>
                )}
                {stemImageChanges.removed > 0 && (
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <ImageMinus className="h-3 w-3" />
                    <span>-{stemImageChanges.removed}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Answer Options */}
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2 uppercase">
            Answer Options
          </div>
          <div className="space-y-2">
            {options.map((option, index: number) => {
              const optionLabels = ["A", "B", "C", "D", "E"];
              const optionLabel = optionLabels[index] || (index + 1).toString();

              const compareOption = compareOptions[index];
              const changed =
                optionsChanged &&
                compareOption &&
                (option.text !== compareOption.text ||
                  option.is_correct !== compareOption.is_correct);

              return (
                <div
                  key={option.id || index}
                  className={`p-2 rounded-md border text-xs ${
                    changed
                      ? "bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800"
                      : option.is_correct
                        ? "bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-800"
                        : "border-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex items-center justify-center w-4 h-4 rounded-full border text-xs shrink-0">
                      {optionLabel}
                    </span>
                    <span className="flex-1">{option.text}</span>
                    {option.is_correct && <Check className="w-3 h-3 text-green-500 shrink-0" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Teaching Point */}
        {versionData.teaching_point && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase">
              Teaching Point
            </div>
            {teachingPointChanged && compareWith ? (
              <DiffText
                oldText={compareData.teaching_point || ""}
                newText={versionData.teaching_point || ""}
              />
            ) : (
              <div className="leading-relaxed">{versionData.teaching_point}</div>
            )}
          </div>
        )}

        {/* Explanation Images */}
        {(explanationImages.length > 0 || explanationImageChanges?.changed) && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase">
              Explanation Images
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {Array.from({ length: explanationImages.length }).map((_, i) => (
                <div
                  key={i}
                  className="w-12 h-12 bg-muted border-2 border-dashed rounded flex items-center justify-center"
                >
                  <span className="text-[10px] text-muted-foreground">{i + 1}</span>
                </div>
              ))}
              {explanationImages.length === 0 && (
                <span className="text-xs text-muted-foreground italic">No images</span>
              )}
            </div>
            {explanationImageChanges?.changed && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                {explanationImageChanges.added > 0 && (
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <ImagePlus className="h-3 w-3" />
                    <span>+{explanationImageChanges.added}</span>
                  </div>
                )}
                {explanationImageChanges.removed > 0 && (
                  <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <ImageMinus className="h-3 w-3" />
                    <span>-{explanationImageChanges.removed}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* References */}
        {versionData.question_references && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase">
              References
            </div>
            {referencesChanged && compareWith ? (
              <DiffText
                oldText={formatReferences(compareData.question_references || "")}
                newText={formatReferences(versionData.question_references || "")}
              />
            ) : (
              <div className="leading-relaxed whitespace-pre-wrap">
                {formatReferences(versionData.question_references)}
              </div>
            )}
          </div>
        )}

        {/* Difficulty */}
        <div className="pt-2 border-t">
          <div className="text-xs font-medium text-muted-foreground mb-1.5 uppercase">
            Difficulty
          </div>
          {difficultyChanged && compareWith ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="opacity-60 line-through">
                {compareData.difficulty?.charAt(0).toUpperCase() +
                  compareData.difficulty?.slice(1) || "Medium"}
              </Badge>
              <span className="text-muted-foreground">→</span>
              <Badge variant="default" className="bg-blue-500">
                {versionData.difficulty?.charAt(0).toUpperCase() +
                  versionData.difficulty?.slice(1) || "Medium"}
              </Badge>
            </div>
          ) : (
            <Badge variant="outline">
              {versionData.difficulty?.charAt(0).toUpperCase() + versionData.difficulty?.slice(1) ||
                "Medium"}
            </Badge>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogPortal>
        <DialogOverlay className="backdrop-blur-md bg-black/20" />
        <DialogContent className="w-full !max-w-[min(95vw,1600px)] max-h-[90vh] p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </DialogTitle>
            <DialogDescription>
              {questionTitle
                ? `Version history for "${questionTitle}"`
                : "Question version history"}
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex h-[calc(90vh-140px)]">
              {/* Column 1 Skeleton: Version List */}
              <div className="w-80 border-r overflow-y-auto shrink-0">
                <div className="p-4 space-y-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="border rounded-lg p-3 space-y-2 animate-pulse">
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-16 bg-muted rounded" />
                        <div className="h-4 w-12 bg-muted rounded" />
                      </div>
                      <div className="space-y-1">
                        <div className="h-3 w-32 bg-muted rounded" />
                        <div className="h-3 w-36 bg-muted rounded" />
                      </div>
                      <div className="h-3 w-full bg-muted rounded" />
                      <div className="h-3 w-4/5 bg-muted rounded" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 2 Skeleton: Content */}
              <div className="flex-1 overflow-y-auto">
                <div className="p-6 sticky top-0 bg-background/95 backdrop-blur border-b">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-muted" />
                    <div className="h-4 w-24 bg-muted rounded" />
                    <div className="h-4 w-16 bg-muted rounded" />
                  </div>
                  <div className="h-3 w-48 bg-muted rounded mt-2" />
                </div>
                <div className="p-6 space-y-4 animate-pulse">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 w-20 bg-muted rounded" />
                      <div className="h-4 w-full bg-muted rounded" />
                      {i % 2 === 0 && <div className="h-4 w-3/4 bg-muted rounded" />}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12">
              <History className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-sm font-medium text-muted-foreground">
                No version history available
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Version history will appear here when the question is updated.
              </p>
            </div>
          ) : (
            <div className="flex h-[calc(90vh-140px)]">
              {/* Column 1: Version List */}
              <div className="w-80 border-r overflow-y-auto shrink-0">
                <div className="p-4 space-y-2">
                  {versions.map((version, index) => {
                    const isCurrent = version.is_current || index === 0;
                    const isSelected = selectedVersionIndex === index;

                    return (
                      <button
                        key={version.id}
                        onClick={() => setSelectedVersionIndex(index)}
                        className={`w-full text-left border rounded-lg p-3 transition-all ${
                          isSelected
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "hover:bg-muted/30 hover:border-muted-foreground/30"
                        } ${
                          isCurrent && !isSelected
                            ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20"
                            : ""
                        }`}
                      >
                        <div className="space-y-2">
                          {/* Version number and badge */}
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm font-semibold">
                              {formatVersion(
                                version.version_major,
                                version.version_minor,
                                version.version_patch
                              )}
                            </span>
                            {isCurrent && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-green-600 border-green-600 dark:text-green-400 dark:border-green-400"
                              >
                                Current
                              </Badge>
                            )}
                          </div>

                          {/* Creator and date */}
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                {version.creator
                                  ? `${version.creator.first_name} ${version.creator.last_name}`
                                  : "Unknown"}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Calendar className="h-3 w-3 shrink-0" />
                              <span>{formatDate(version.created_at)}</span>
                            </div>
                          </div>

                          {/* Change summary */}
                          {version.change_summary && (
                            <div className="pt-1">
                              <p className="text-xs text-foreground/80 line-clamp-2">
                                {version.change_summary}
                              </p>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Column 2: Selected Version with Diff */}
              {selectedVersion && (
                <div className="flex-1 overflow-y-auto">
                  <div className="p-6 sticky top-0 bg-background/95 backdrop-blur border-b z-10">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-primary" />
                      <h4 className="font-medium text-sm">
                        Version{" "}
                        {formatVersion(
                          selectedVersion.version_major,
                          selectedVersion.version_minor,
                          selectedVersion.version_patch
                        )}
                      </h4>
                      {(selectedVersion.is_current || selectedVersionIndex === 0) && (
                        <Badge
                          variant="outline"
                          className="text-xs text-green-600 border-green-600 dark:text-green-400 dark:border-green-400"
                        >
                          Current
                        </Badge>
                      )}
                    </div>
                    {selectedVersion.change_summary && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {selectedVersion.change_summary}
                      </p>
                    )}
                    {previousVersion && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Comparing with{" "}
                        {formatVersion(
                          previousVersion.version_major,
                          previousVersion.version_minor,
                          previousVersion.version_patch
                        )}
                      </p>
                    )}
                  </div>
                  <div className="p-6">
                    {previousVersion ? (
                      renderVersionContent(selectedVersion, true, previousVersion)
                    ) : (
                      <>
                        <div className="mb-4 p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-800">
                          <p className="text-xs font-medium text-blue-900 dark:text-blue-200">
                            Initial version (
                            {formatVersion(
                              selectedVersion.version_major,
                              selectedVersion.version_minor,
                              selectedVersion.version_patch
                            )}
                            ) - No previous version to compare
                          </p>
                        </div>
                        {renderVersionContent(selectedVersion, false)}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
