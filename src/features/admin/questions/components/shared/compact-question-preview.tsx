"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Check, ExternalLink, Copy, FileText, Braces } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { toast } from "@/shared/utils/ui/toast";
import { DIFFICULTY_CONFIG, QuestionWithDetails } from "@/shared/types/questions";
import { SimpleImageCarousel } from "./simple-image-carousel";
import { getCategoryColor } from "@/shared/utils/category-colors";
import { formatQuestionVersion } from "@/shared/utils/version";

interface CompactQuestionPreviewProps {
  question: QuestionWithDetails | null;
}

export function CompactQuestionPreview({ question }: CompactQuestionPreviewProps) {
  if (!question) {
    return (
      <Card className="h-full">
        <CardContent className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Select a question to preview</p>
        </CardContent>
      </Card>
    );
  }

  const getOptionLabel = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D, E
  };

  // Get question images for the stem
  const stemImages = question.question_images?.filter((qi) => qi.question_section === "stem") || [];
  const explanationImages =
    question.question_images?.filter((qi) => qi.question_section === "explanation") || [];

  // Get incorrect options with explanations
  const incorrectOptions =
    question.question_options?.filter((option) => !option.is_correct && option.explanation) || [];

  const copyAsText = () => {
    const options =
      question.question_options
        ?.map((opt, i) => {
          const label = getOptionLabel(i);
          const marker = opt.is_correct ? " [correct]" : "";
          const explanation = opt.explanation ? `\n     Explanation: ${opt.explanation}` : "";
          return `  ${label}. ${opt.text}${marker}${explanation}`;
        })
        .join("\n") || "";

    const parts = [question.title, "", question.stem, "", "Options:", options];

    if (question.teaching_point) {
      parts.push("", "Teaching Point:", question.teaching_point);
    }

    if (question.question_references) {
      parts.push("", "References:", question.question_references);
    }

    navigator.clipboard.writeText(parts.join("\n"));
    toast.success("Question text copied");
  };

  const copyAsJson = () => {
    const json = {
      id: question.id,
      title: question.title,
      stem: question.stem,
      difficulty: question.difficulty,
      teaching_point: question.teaching_point,
      question_references: question.question_references,
      lesson: question.lesson,
      topic: question.topic,
      category: question.category?.name,
      question_set: (question.set || question.question_set)?.name,
      options: question.question_options?.map((opt, i) => ({
        label: getOptionLabel(i),
        text: opt.text,
        is_correct: opt.is_correct,
        explanation: opt.explanation || undefined,
      })),
    };
    navigator.clipboard.writeText(JSON.stringify(json, null, 2));
    toast.success("Question JSON copied");
  };

  return (
    <div className="w-full mx-auto">
      <Card className="h-full">
        <CardHeader className="py-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{question.title}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copyAsText}>
                <FileText className="h-4 w-4 mr-2" />
                Copy as text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={copyAsJson}>
                <Braces className="h-4 w-4 mr-2" />
                Copy as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Question Stem */}
          <div className="text-sm text-foreground/90">{question.stem}</div>

          {/* Stem Images */}
          {stemImages.length > 0 && (
            <div>
              <SimpleImageCarousel
                images={stemImages
                  .filter((si) => si.image?.url)
                  .map((si) => ({
                    url: si.image?.url || "",
                    alt: si.image?.alt_text || "Question image",
                    caption: si.image?.description || undefined,
                  }))}
                className="border rounded-lg"
                resetKey={`stem-${question.id}`}
              />
            </div>
          )}

          {/* Answer Options */}
          <div className="space-y-2" role="listbox" aria-label="Answer options">
            {question.question_options && question.question_options.length > 0 ? (
              question.question_options.map((option, index) => {
                const isCorrect = option.is_correct;
                const optionLabel = getOptionLabel(index);

                return (
                  <div
                    key={option.id}
                    className={`
                      p-3 rounded-md text-left border text-sm
                      ${isCorrect ? "bg-green-50 border-green-500 dark:bg-green-950/30" : "border"}
                    `}
                    role="option"
                    aria-selected={isCorrect}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`
                        flex items-center justify-center w-5 h-5 rounded-full border text-xs
                        ${isCorrect ? "border-green-500" : "border-muted-foreground/30"}
                      `}
                      >
                        {optionLabel}
                      </span>
                      <span className="flex-1">{option.text}</span>
                      {isCorrect && <Check className="w-4 h-4 text-green-500" />}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-muted-foreground">
                No answer options available
              </div>
            )}
          </div>

          {/* Teaching Point and Explanation - Always shown in preview */}
          {(question.teaching_point ||
            explanationImages.length > 0 ||
            question.question_references ||
            incorrectOptions.length > 0) && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-4">
              {/* Teaching Point */}
              {question.teaching_point && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">Teaching Point</h4>
                  <div className="text-muted-foreground">{question.teaching_point}</div>
                </div>
              )}

              {/* Incorrect Option Explanations */}
              {incorrectOptions.length > 0 && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-2">
                    Why Other Options Are Incorrect
                  </h4>
                  <div className="space-y-2">
                    {incorrectOptions.map((option) => {
                      const originalIndex =
                        question.question_options?.findIndex((opt) => opt.id === option.id) || 0;
                      const optionLabel = getOptionLabel(originalIndex);

                      return (
                        <div
                          key={option.id}
                          className="text-xs p-2 rounded border-l-2 bg-muted/30 border-l-muted-foreground/30 text-muted-foreground"
                        >
                          <span className="font-medium">{optionLabel}. </span>
                          {option.explanation}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Explanation Images */}
              {explanationImages.length > 0 && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-2">Reference Images</h4>
                  <SimpleImageCarousel
                    images={explanationImages
                      .filter((ei) => ei.image?.url)
                      .map((ei) => ({
                        url: ei.image?.url || "",
                        alt: ei.image?.alt_text || "Reference image",
                        caption: ei.image?.description || undefined,
                      }))}
                    className="bg-white border rounded-lg"
                    resetKey={`explanation-${question.id}`}
                  />
                </div>
              )}

              {/* References */}
              {question.question_references && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-1">References</h4>
                  <div className="text-muted-foreground text-xs">
                    {question.question_references}
                  </div>
                </div>
              )}

              {/* Anki Card Link */}
              {question.anki_card_id && (
                <div>
                  <h4 className="font-medium text-xs uppercase mb-2">Linked Anki Card</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      ID: {question.anki_card_id}
                    </Badge>
                    {question.anki_deck_name && (
                      <Badge variant="secondary" className="text-xs">
                        {question.anki_deck_name}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() =>
                        window.open(
                          `/dashboard/anki?cardId=${encodeURIComponent(question.anki_card_id)}`,
                          "_blank"
                        )
                      }
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      View
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Question Metadata */}
          <div className="pt-3 border-t space-y-1.5">
            {/* Row 1: All badges — Category, Difficulty, Question Set, Tags, Version */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              {question.category &&
                (() => {
                  const categoryColor = getCategoryColor({
                    color: question.category.color ?? undefined,
                    short_form: question.category.short_form ?? undefined,
                    parent_short_form: undefined,
                  });

                  return (
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        backgroundColor: `${categoryColor}15`,
                        borderColor: categoryColor,
                        color: categoryColor,
                      }}
                    >
                      {question.category.name}
                    </Badge>
                  );
                })()}

              {question.difficulty && (
                <Badge
                  variant="outline"
                  className={`text-xs border ${DIFFICULTY_CONFIG[question.difficulty as keyof typeof DIFFICULTY_CONFIG]?.color || ""}`}
                >
                  {question.difficulty}
                </Badge>
              )}

              {(question.set || question.question_set) && (
                <Badge variant="outline" className="text-xs">
                  {(question.set || question.question_set)?.name || "Unknown"}
                </Badge>
              )}

              <Badge variant="outline" className="text-xs font-mono">
                {formatQuestionVersion(question)}
              </Badge>

              {question.tags &&
                question.tags.length > 0 &&
                question.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary" className="text-xs px-1.5 py-0">
                    {tag.name}
                  </Badge>
                ))}
            </div>

            {/* Row 2: Lesson/Topic + Attribution */}
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {question.lesson && (
                <span>
                  <span className="font-medium">Lesson:</span> {question.lesson}
                </span>
              )}
              {question.lesson && question.topic && <span>•</span>}
              {question.topic && (
                <span>
                  <span className="font-medium">Topic:</span> {question.topic}
                </span>
              )}
              {(question.lesson || question.topic) && question.created_at && <span>•</span>}
              {question.created_at && (
                <span>
                  Created
                  {question.created_by_name && <> by {question.created_by_name}</>} on{" "}
                  {new Date(question.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              )}
              {question.updated_at && question.updated_at !== question.created_at && (
                <>
                  <span>•</span>
                  <span>
                    Modified
                    {question.updated_by_name && <> by {question.updated_by_name}</>} on{" "}
                    {new Date(question.updated_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
