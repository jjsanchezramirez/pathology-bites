// src/app/(dashboard)/dashboard/progress/page.tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { Progress } from "@/shared/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import { 
  TrendingUp, 
  Calendar,
  Award,
  Clock,
  Target,
  BarChart3,
  Activity,
  CheckCircle
} from "lucide-react"

export default function ProgressPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Learning Progress</h1>
        <p className="text-muted-foreground">
          Track your learning journey and celebrate your achievements
        </p>
      </div>

      {/* Progress Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Progress</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">68%</div>
            <p className="text-xs text-muted-foreground">
              +12% this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Days</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achievements</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">
              Badges earned
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">127h</div>
            <p className="text-xs text-muted-foreground">
              Total time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Progress Details */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="categories">By Category</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Weekly Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { week: "This Week", questions: 45, target: 50, percentage: 90 },
                    { week: "Last Week", questions: 52, target: 50, percentage: 104 },
                    { week: "2 Weeks Ago", questions: 38, target: 50, percentage: 76 },
                    { week: "3 Weeks Ago", questions: 41, target: 50, percentage: 82 },
                  ].map((week) => (
                    <div key={week.week} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{week.week}</span>
                        <span>{week.questions}/{week.target} questions</span>
                      </div>
                      <Progress value={week.percentage} className="h-2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Current Streak
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div className="text-4xl font-bold text-primary">12</div>
                <p className="text-muted-foreground">days in a row</p>
                <div className="flex justify-center gap-1">
                  {Array.from({ length: 7 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-3 h-3 rounded-full ${
                        i < 5 ? 'bg-primary' : 'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">This week</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Progress by Category</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { name: "General Pathology", progress: 95, questions: 156, mastery: "Expert" },
                { name: "Renal Pathology", progress: 88, questions: 89, mastery: "Advanced" },
                { name: "Dermatopathology", progress: 72, questions: 67, mastery: "Intermediate" },
                { name: "Hematopathology", progress: 65, questions: 45, mastery: "Intermediate" },
                { name: "GI Pathology", progress: 58, questions: 78, mastery: "Beginner" },
                { name: "Neuropathology", progress: 23, questions: 12, mastery: "Beginner" },
              ].map((category) => (
                <div key={category.name} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{category.name}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{category.mastery}</Badge>
                      <span className="text-sm">{category.progress}%</span>
                    </div>
                  </div>
                  <Progress value={category.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {category.questions} questions completed
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "First Steps", description: "Complete your first quiz", earned: true, date: "2 weeks ago" },
              { name: "Week Warrior", description: "Study for 7 consecutive days", earned: true, date: "1 week ago" },
              { name: "Century Club", description: "Answer 100 questions", earned: true, date: "5 days ago" },
              { name: "Perfect Score", description: "Get 100% on a quiz", earned: true, date: "3 days ago" },
              { name: "Category Master", description: "Achieve 90% in any category", earned: false },
              { name: "Marathon", description: "Study for 30 consecutive days", earned: false },
            ].map((achievement) => (
              <Card key={achievement.name} className={achievement.earned ? "border-yellow-200 bg-yellow-50/50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-full ${achievement.earned ? "bg-yellow-100" : "bg-gray-100"}`}>
                      <Award className={`h-5 w-5 ${achievement.earned ? "text-yellow-600" : "text-gray-400"}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">{achievement.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{achievement.description}</p>
                      {achievement.earned ? (
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Earned {achievement.date}
                        </Badge>
                      ) : (
                        <Badge variant="outline">Not earned</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { action: "Completed Renal Pathology Quiz", score: "85%", time: "2 hours ago" },
                  { action: "Started Inflammation module", score: null, time: "1 day ago" },
                  { action: "Achieved Perfect Score badge", score: "100%", time: "3 days ago" },
                  { action: "Completed Cell Death quiz", score: "92%", time: "4 days ago" },
                  { action: "Started learning path", score: null, time: "1 week ago" },
                ].map((activity, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="w-2 h-2 bg-primary rounded-full" />
                    <div className="flex-1">
                      <p className="font-medium">{activity.action}</p>
                      <p className="text-sm text-muted-foreground">{activity.time}</p>
                    </div>
                    {activity.score && (
                      <Badge variant="outline">{activity.score}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
