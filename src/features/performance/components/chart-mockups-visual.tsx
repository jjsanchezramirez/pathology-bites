// src/features/performance/components/chart-mockups-visual.tsx
// Visual mockups with actual SVG-based chart representations

"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { TrendingUp, Calendar, Target, Zap, Award } from "lucide-react";

/**
 * MOCKUP 1: Performance Over Time Line Chart
 */
export function PerformanceTimelineChartMockup() {
  // Sample data points for the mockup
  const data = [65, 68, 72, 70, 75, 78, 82, 80, 85, 88, 90, 87, 89, 92, 90];
  const width = 600;
  const height = 200;
  const padding = 20;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min;

  const points = data
    .map((value, index) => {
      const x = padding + (index / (data.length - 1)) * (width - padding * 2);
      const y = padding + ((max - value) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Performance Timeline
        </CardTitle>
        <CardDescription>Your accuracy over the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Badge variant="outline">30 Days</Badge>
            <Badge variant="default">7 Days</Badge>
            <Badge variant="outline">All Time</Badge>
          </div>

          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((percent) => {
              const y = padding + ((100 - percent) / 100) * (height - padding * 2);
              return (
                <g key={percent}>
                  <line
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4,4"
                  />
                  <text
                    x={padding - 10}
                    y={y + 4}
                    fontSize="10"
                    fill="currentColor"
                    opacity={0.5}
                    textAnchor="end"
                  >
                    {percent}%
                  </text>
                </g>
              );
            })}

            {/* Area fill */}
            <path
              d={`M ${padding},${height - padding} L ${points} L ${width - padding},${height - padding} Z`}
              fill="currentColor"
              fillOpacity={0.1}
              className="text-blue-500"
            />

            {/* Line */}
            <polyline
              points={points}
              fill="none"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-blue-500"
            />

            {/* Points */}
            {data.map((value, index) => {
              const x = padding + (index / (data.length - 1)) * (width - padding * 2);
              const y = padding + ((max - value) / range) * (height - padding * 2);
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={4}
                  fill="currentColor"
                  className="text-blue-500"
                />
              );
            })}
          </svg>

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Day 1</span>
            <span>Today</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * MOCKUP 2: Category Comparison Radar Chart
 */
export function CategoryRadarChartMockup() {
  const categories = [
    { name: "Cardiovascular", value: 85 },
    { name: "Respiratory", value: 72 },
    { name: "GI", value: 90 },
    { name: "Renal", value: 68 },
    { name: "Neuro", value: 78 },
    { name: "Heme", value: 82 },
  ];

  const size = 300;
  const center = size / 2;
  const radius = size / 2 - 60;
  const angleStep = (2 * Math.PI) / categories.length;

  // Calculate polygon points
  const points = categories
    .map((cat, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const r = (cat.value / 100) * radius;
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Category Comparison
        </CardTitle>
        <CardDescription>Your performance across all categories</CardDescription>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-auto max-w-md mx-auto">
          {/* Concentric circles (grid) */}
          {[20, 40, 60, 80, 100].map((percent) => (
            <circle
              key={percent}
              cx={center}
              cy={center}
              r={(percent / 100) * radius}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeDasharray="4,4"
            />
          ))}

          {/* Axes */}
          {categories.map((cat, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const x = center + radius * Math.cos(angle);
            const y = center + radius * Math.sin(angle);
            const labelX = center + (radius + 30) * Math.cos(angle);
            const labelY = center + (radius + 30) * Math.sin(angle);

            return (
              <g key={cat.name}>
                <line
                  x1={center}
                  y1={center}
                  x2={x}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.2}
                />
                <text
                  x={labelX}
                  y={labelY}
                  fontSize="11"
                  fill="currentColor"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="font-medium"
                >
                  {cat.name}
                </text>
              </g>
            );
          })}

          {/* Data polygon */}
          <polygon
            points={points}
            fill="currentColor"
            fillOpacity={0.2}
            stroke="currentColor"
            strokeWidth={2}
            className="text-purple-500"
          />

          {/* Data points */}
          {categories.map((cat, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const r = (cat.value / 100) * radius;
            const x = center + r * Math.cos(angle);
            const y = center + r * Math.sin(angle);

            return (
              <circle key={i} cx={x} cy={y} r={5} fill="currentColor" className="text-purple-500" />
            );
          })}
        </svg>
      </CardContent>
    </Card>
  );
}

/**
 * MOCKUP 3: Activity Heatmap Calendar
 */
export function ActivityHeatmapMockup() {
  // Generate sample activity data for the last 12 weeks
  const weeks = 12;
  const days = 7;
  const activityData: number[][] = [];

  for (let week = 0; week < weeks; week++) {
    const weekData: number[] = [];
    for (let day = 0; day < days; day++) {
      weekData.push(Math.floor(Math.random() * 5)); // 0-4 activity level
    }
    activityData.push(weekData);
  }

  const cellSize = 12;
  const cellGap = 3;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Activity Calendar
        </CardTitle>
        <CardDescription>Your quiz activity over the last 12 weeks</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <svg
              width={(cellSize + cellGap) * weeks}
              height={(cellSize + cellGap) * days + 20}
              className="mx-auto"
            >
              {/* Day labels */}
              {["Mon", "Wed", "Fri"].map((day, index) => (
                <text
                  key={day}
                  x={-5}
                  y={(cellSize + cellGap) * (index * 2 + 1) + cellSize / 2}
                  fontSize="10"
                  fill="currentColor"
                  opacity={0.5}
                  textAnchor="end"
                >
                  {day}
                </text>
              ))}

              {/* Activity cells */}
              {activityData.map((week, weekIndex) =>
                week.map((activity, dayIndex) => {
                  const colors = [
                    "fill-gray-200 dark:fill-gray-800",
                    "fill-green-200 dark:fill-green-900",
                    "fill-green-400 dark:fill-green-700",
                    "fill-green-600 dark:fill-green-500",
                    "fill-green-800 dark:fill-green-400",
                  ];

                  return (
                    <rect
                      key={`${weekIndex}-${dayIndex}`}
                      x={weekIndex * (cellSize + cellGap)}
                      y={dayIndex * (cellSize + cellGap)}
                      width={cellSize}
                      height={cellSize}
                      rx={2}
                      className={colors[activity]}
                    />
                  );
                })
              )}
            </svg>
          </div>

          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="text-muted-foreground">Less</span>
            <div className="flex gap-1">
              {[0, 1, 2, 3, 4].map((level) => {
                const colors = [
                  "bg-gray-200 dark:bg-gray-800",
                  "bg-green-200 dark:bg-green-900",
                  "bg-green-400 dark:bg-green-700",
                  "bg-green-600 dark:bg-green-500",
                  "bg-green-800 dark:bg-green-400",
                ];
                return <div key={level} className={`w-3 h-3 rounded-sm ${colors[level]}`} />;
              })}
            </div>
            <span className="text-muted-foreground">More</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * MOCKUP 4: Speed vs Accuracy Scatter Plot
 */
export function SpeedAccuracyScatterMockup() {
  // Generate sample data points
  const dataPoints = Array.from({ length: 50 }, () => ({
    time: Math.random() * 120 + 10, // 10-130 seconds
    correct: Math.random() > 0.3, // 70% correct rate
  }));

  const width = 400;
  const height = 300;
  const padding = 40;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Speed vs Accuracy
        </CardTitle>
        <CardDescription>How your speed correlates with accuracy</CardDescription>
      </CardHeader>
      <CardContent>
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Axes */}
          <line
            x1={padding}
            y1={height - padding}
            x2={width - padding}
            y2={height - padding}
            stroke="currentColor"
            strokeOpacity={0.3}
          />
          <line
            x1={padding}
            y1={padding}
            x2={padding}
            y2={height - padding}
            stroke="currentColor"
            strokeOpacity={0.3}
          />

          {/* Axis labels */}
          <text
            x={width / 2}
            y={height - 5}
            fontSize="12"
            fill="currentColor"
            opacity={0.6}
            textAnchor="middle"
          >
            Time (seconds)
          </text>
          <text
            x={15}
            y={height / 2}
            fontSize="12"
            fill="currentColor"
            opacity={0.6}
            textAnchor="middle"
            transform={`rotate(-90, 15, ${height / 2})`}
          >
            Correct/Incorrect
          </text>

          {/* Data points */}
          {dataPoints.map((point, i) => {
            const x = padding + (point.time / 130) * (width - padding * 2);
            const y = point.correct
              ? height - padding - 20
              : height - padding - (height - padding * 2) + 20;

            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={4}
                fill="currentColor"
                fillOpacity={0.6}
                className={point.correct ? "text-green-500" : "text-red-500"}
              />
            );
          })}

          {/* Legend */}
          <g transform={`translate(${width - 100}, ${padding})`}>
            <circle cx={0} cy={0} r={4} className="fill-green-500" />
            <text x={10} y={4} fontSize="10" fill="currentColor" opacity={0.7}>
              Correct
            </text>
            <circle cx={0} cy={15} r={4} className="fill-red-500" />
            <text x={10} y={19} fontSize="10" fill="currentColor" opacity={0.7}>
              Incorrect
            </text>
          </g>
        </svg>
      </CardContent>
    </Card>
  );
}

/**
 * MOCKUP 5: Weekly Performance Bar Chart
 */
export function WeeklyBarChartMockup() {
  const weeks = [
    { week: "Week 1", quizzes: 5, accuracy: 72, time: 45 },
    { week: "Week 2", quizzes: 8, accuracy: 78, time: 60 },
    { week: "Week 3", quizzes: 6, accuracy: 85, time: 50 },
    { week: "Week 4", quizzes: 10, accuracy: 88, time: 75 },
  ];

  const width = 500;
  const height = 250;
  const padding = 40;
  const barWidth = 40;
  const groupGap = 20;
  const barGap = 5;

  const maxQuizzes = Math.max(...weeks.map((w) => w.quizzes));
  const chartHeight = height - padding * 2;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Weekly Breakdown
        </CardTitle>
        <CardDescription>Compare your performance week by week</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex gap-2 justify-center">
            <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-950">
              Quizzes
            </Badge>
            <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-950">
              Accuracy
            </Badge>
            <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-950">
              Time (min)
            </Badge>
          </div>

          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
            {/* Axes */}
            <line
              x1={padding}
              y1={height - padding}
              x2={width - padding}
              y2={height - padding}
              stroke="currentColor"
              strokeOpacity={0.3}
            />

            {/* Bars */}
            {weeks.map((week, weekIndex) => {
              const groupX = padding + weekIndex * (barWidth * 3 + barGap * 2 + groupGap);

              // Quizzes bar
              const quizzesHeight = (week.quizzes / maxQuizzes) * chartHeight;
              // Accuracy bar (scale to max)
              const accuracyHeight = (week.accuracy / 100) * chartHeight;
              // Time bar (scale to max)
              const timeHeight = (week.time / 75) * chartHeight;

              return (
                <g key={weekIndex}>
                  {/* Quizzes */}
                  <rect
                    x={groupX}
                    y={height - padding - quizzesHeight}
                    width={barWidth}
                    height={quizzesHeight}
                    className="fill-blue-500"
                    fillOpacity={0.8}
                  />
                  {/* Accuracy */}
                  <rect
                    x={groupX + barWidth + barGap}
                    y={height - padding - accuracyHeight}
                    width={barWidth}
                    height={accuracyHeight}
                    className="fill-green-500"
                    fillOpacity={0.8}
                  />
                  {/* Time */}
                  <rect
                    x={groupX + (barWidth + barGap) * 2}
                    y={height - padding - timeHeight}
                    width={barWidth}
                    height={timeHeight}
                    className="fill-purple-500"
                    fillOpacity={0.8}
                  />

                  {/* Week label */}
                  <text
                    x={groupX + (barWidth * 3 + barGap * 2) / 2}
                    y={height - padding + 20}
                    fontSize="12"
                    fill="currentColor"
                    opacity={0.7}
                    textAnchor="middle"
                  >
                    {week.week}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Container component to display all visual mockups
 */
export function ChartMockupsShowcase() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Chart Options</h2>
        <p className="text-muted-foreground">
          Here are visual mockups of different chart types. These are SVG representations - let me
          know which ones you'd like to implement with real interactive charts!
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PerformanceTimelineChartMockup />
        <CategoryRadarChartMockup />
      </div>

      <ActivityHeatmapMockup />

      <div className="grid gap-6 lg:grid-cols-2">
        <SpeedAccuracyScatterMockup />
        <WeeklyBarChartMockup />
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle>Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">These are static SVG mockups</h4>
            <p className="text-sm text-muted-foreground">
              The real implementation would use <strong>Recharts</strong> library for interactive
              charts with hover states, tooltips, animations, and responsive behavior.
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Recommended Priority:</h4>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>
                <strong>Performance Timeline</strong> - Shows improvement trends (most valuable)
              </li>
              <li>
                <strong>Category Radar</strong> - Great for visualizing strengths/weaknesses
              </li>
              <li>
                <strong>Activity Heatmap</strong> - Motivating consistency tracker
              </li>
              <li>
                <strong>Weekly Bar Chart</strong> - Good for weekly review
              </li>
              <li>
                <strong>Speed vs Accuracy</strong> - Advanced insight
              </li>
            </ol>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">
              Which charts would you like to implement? I can build them with real data and
              interactivity using Recharts.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
