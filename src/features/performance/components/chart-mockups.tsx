// src/features/performance/components/chart-mockups.tsx
// This file contains mockups of different chart types for the performance page
// Choose which ones you'd like to implement!

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
 * Shows accuracy trending over the last 30 days
 * Library suggestion: Recharts LineChart
 */
export function PerformanceTimelineChartMockup() {
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
        <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed">
          <div className="text-center space-y-2">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">Line Chart Mockup</p>
            <p className="text-xs text-muted-foreground">
              Interactive line chart showing daily/weekly accuracy trends
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <Badge variant="outline">30 Days</Badge>
              <Badge variant="outline">7 Days</Badge>
              <Badge variant="outline">All Time</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * MOCKUP 2: Category Comparison Radar Chart
 * Shows performance across different pathology categories in a spider/radar chart
 * Library suggestion: Recharts RadarChart
 */
export function CategoryRadarChartMockup() {
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
        <div className="h-80 flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed">
          <div className="text-center space-y-2">
            <Target className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">Radar Chart Mockup</p>
            <p className="text-xs text-muted-foreground max-w-md">
              Spider/Radar chart showing your accuracy in each category
              <br />
              (Cardiovascular, Respiratory, GI, Renal, etc.)
            </p>
            <div className="mt-4 text-xs text-muted-foreground">
              Hover over each axis to see detailed stats
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * MOCKUP 3: Activity Heatmap Calendar
 * GitHub-style activity calendar showing quiz activity
 * Library suggestion: react-calendar-heatmap or custom implementation
 */
export function ActivityHeatmapMockup() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Activity Calendar
        </CardTitle>
        <CardDescription>Your quiz activity over time</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-40 flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed">
          <div className="text-center space-y-2">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">Activity Heatmap Mockup</p>
            <p className="text-xs text-muted-foreground">
              GitHub-style contribution graph showing quiz activity
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-200 rounded-sm" />
                <span className="text-xs">Light</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-500 rounded-sm" />
                <span className="text-xs">Medium</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 bg-green-700 rounded-sm" />
                <span className="text-xs">Heavy</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * MOCKUP 4: Speed vs Accuracy Scatter Plot
 * Shows relationship between answer speed and accuracy
 * Library suggestion: Recharts ScatterChart
 */
export function SpeedAccuracyScatterMockup() {
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
        <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed">
          <div className="text-center space-y-2">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">Scatter Plot Mockup</p>
            <p className="text-xs text-muted-foreground max-w-md">
              Each dot represents a question answered
              <br />
              X-axis: Time taken, Y-axis: Correct/Incorrect
            </p>
            <div className="mt-4 text-xs text-muted-foreground">
              Identifies your "sweet spot" for optimal performance
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * MOCKUP 5: Weekly Performance Bar Chart
 * Shows weekly performance comparison
 * Library suggestion: Recharts BarChart
 */
export function WeeklyBarChartMockup() {
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
        <div className="h-64 flex items-center justify-center bg-muted/30 rounded-lg border-2 border-dashed">
          <div className="text-center space-y-2">
            <Award className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">Bar Chart Mockup</p>
            <p className="text-xs text-muted-foreground">
              Stacked bars showing quizzes completed, accuracy, and time spent per week
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-950">
                Quizzes
              </Badge>
              <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-950">
                Accuracy
              </Badge>
              <Badge variant="outline" className="bg-purple-100 text-purple-800 dark:bg-purple-950">
                Time
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Container component to display all mockups
 */
export function ChartMockupsShowcase() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Chart Mockups</h2>
        <p className="text-muted-foreground">
          Preview different chart options for the performance page. These are mockups - choose which
          ones to implement!
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PerformanceTimelineChartMockup />
        <CategoryRadarChartMockup />
        <ActivityHeatmapMockup />
        <SpeedAccuracyScatterMockup />
        <WeeklyBarChartMockup />
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-900">
        <CardHeader>
          <CardTitle>Implementation Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Recommended: Recharts</h4>
            <p className="text-sm text-muted-foreground">
              Simple, React-friendly, composable charts with good TypeScript support. Install with:{" "}
              <code className="bg-muted px-1 rounded">npm install recharts</code>
            </p>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Chart Priority Suggestions:</h4>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>
                <strong>Performance Timeline</strong> - Most valuable for tracking improvement
              </li>
              <li>
                <strong>Category Radar</strong> - Great visual for comparing strengths/weaknesses
              </li>
              <li>
                <strong>Activity Heatmap</strong> - Motivating visual for consistency
              </li>
              <li>
                <strong>Weekly Bar Chart</strong> - Good for weekly review habits
              </li>
              <li>
                <strong>Speed vs Accuracy</strong> - Advanced insight, lower priority
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
