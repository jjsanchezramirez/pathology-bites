// src/features/dashboard/components/performance-analytics.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { TrendingUp, TrendingDown, Target, Users } from "lucide-react";

interface PerformanceData {
  userPercentile: number;
  peerRank: number;
  totalUsers: number;
  completedQuizzes: number;
  subjectsForImprovement: Array<{
    name: string;
    score: number;
    attempts: number;
  }>;
  subjectsMastered: Array<{
    name: string;
    score: number;
    attempts: number;
  }>;
  overallScore: number;
}

interface PerformanceAnalyticsProps {
  data: PerformanceData;
}

// Resolve CSS variable to hex for SVG compatibility
function resolveCssColor(varName: string): string | null {
  // Create a temporary element to let the browser resolve the CSS variable
  const el = document.createElement("div");
  el.style.color = `var(${varName})`;
  el.style.display = "none";
  document.body.appendChild(el);
  const computed = getComputedStyle(el).color;
  document.body.removeChild(el);

  // Browser returns rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbMatch) {
    const toHex = (n: string) => parseInt(n).toString(16).padStart(2, "0");
    return `#${toHex(rgbMatch[1])}${toHex(rgbMatch[2])}${toHex(rgbMatch[3])}`;
  }
  return null;
}

// Circle progress component
function CircleProgress({
  percentage,
  size = 120,
  strokeWidth = 8,
  color,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const [bgColor, setBgColor] = useState("#e5e7eb");
  const [fgColor, setFgColor] = useState(color || "#3b82f6");

  useEffect(() => {
    const update = () => {
      setBgColor(resolveCssColor("--muted-foreground") || "#9ca3af");
      if (!color) {
        setFgColor(resolveCssColor("--primary") || "#3b82f6");
      }
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [color]);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={bgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color || fgColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-2xl font-bold text-foreground">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}

// Map subject-list length to outer card column span (in a 3-col dashboard grid) and
// the inner grid column count. Cards grow to fit their content: 1 col for ≤3 items,
// 2 cols for 4-6 items, 3 cols for 7+ items. The two subject cards live in the same
// CSS grid, so if their combined spans exceed 3 the second wraps to its own row.
function getSubjectCardLayout(count: number): { cardCols: string; innerCols: string } {
  if (count >= 7) {
    return {
      cardCols: "md:col-span-2 lg:col-span-3",
      innerCols: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    };
  }
  if (count >= 4) {
    return {
      cardCols: "md:col-span-2 lg:col-span-2",
      innerCols: "grid-cols-1 sm:grid-cols-2",
    };
  }
  return {
    cardCols: "md:col-span-2 lg:col-span-1",
    innerCols: "grid-cols-1",
  };
}

export function PerformanceAnalytics({ data }: PerformanceAnalyticsProps) {
  const getRankSuffix = (rank: number) => {
    if (rank % 100 >= 11 && rank % 100 <= 13) return "th";
    switch (rank % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  };

  // Only show percentile and ranking if user has completed at least 3 quizzes
  const showRankingData = data.completedQuizzes >= 3;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* User Percentile - Only show if enough users */}
      {showRankingData ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              Your Percentile
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-2">
            <CircleProgress percentage={data.userPercentile} />
            <p className="text-xs text-muted-foreground text-center">
              You scored better than {data.userPercentile}% of users
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              Your Percentile
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6 sm:py-8 px-4">
            <div className="text-center space-y-2">
              <div className="text-xl sm:text-2xl font-bold text-muted-foreground">
                {data.completedQuizzes}/3
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Complete 3 quizzes to unlock percentile ranking
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Peer Rank - Only show if enough users */}
      {showRankingData ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Peer Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-2 py-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">
                {data.peerRank}
                {getRankSuffix(data.peerRank)}
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                out of {data.totalUsers.toLocaleString()} users
              </div>
              <p className="text-xs text-muted-foreground">Based on overall performance</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Peer Ranking
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6 sm:py-8 px-4">
            <div className="text-center space-y-2">
              <div className="text-xl sm:text-2xl font-bold text-muted-foreground">
                {data.completedQuizzes}/3
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Complete 3 quizzes to unlock peer ranking
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Score */}
      {data.completedQuizzes >= 1 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Overall Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center space-y-2 py-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">{data.overallScore}%</div>
              <div className="text-sm text-muted-foreground mb-3">Average across all quizzes</div>
              <p className="text-xs text-muted-foreground">
                Based on {data.completedQuizzes} completed{" "}
                {data.completedQuizzes === 1 ? "quiz" : "quizzes"}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Overall Score
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6 sm:py-8 px-4">
            <div className="text-center space-y-2">
              <div className="text-xl sm:text-2xl font-bold text-muted-foreground">0/1</div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Complete your first quiz to see your score
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subjects for Improvement — card spans 1/2/3 cols based on item count */}
      {(() => {
        const layout = getSubjectCardLayout(data.subjectsForImprovement.length);
        return (
          <Card className={layout.cardCols}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                Needs Improvement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.subjectsForImprovement.length > 0 ? (
                <div className={`grid ${layout.innerCols} gap-x-4 gap-y-3`}>
                  {data.subjectsForImprovement.map((subject, index) => (
                    <div key={index} className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{subject.name}</p>
                        <p className="text-xs text-muted-foreground">{subject.attempts} attempts</p>
                      </div>
                      <Badge variant="destructive" className="text-xs shrink-0">
                        {subject.score}%
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Great job! No subjects need improvement.
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Mastered Subjects — same dynamic sizing */}
      {(() => {
        const layout = getSubjectCardLayout(data.subjectsMastered.length);
        return (
          <Card className={layout.cardCols}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4 text-green-500" />
                Mastered Subjects
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.subjectsMastered.length > 0 ? (
                <div className={`grid ${layout.innerCols} gap-x-4 gap-y-3`}>
                  {data.subjectsMastered.map((subject, index) => (
                    <div key={index} className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{subject.name}</p>
                        <p className="text-xs text-muted-foreground">{subject.attempts} attempts</p>
                      </div>
                      <Badge
                        variant="default"
                        className="text-xs shrink-0 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                      >
                        {subject.score}%
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Keep practicing to master subjects!
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}
