// src/app/(admin)/admin/page.tsx
import { Metadata } from "next"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileQuestion, Users, Image as ImageIcon, TrendingUp, AlertCircle, CheckCircle2, Clock, ArrowRight } from "lucide-react"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Admin Dashboard - Overview",
  description: "Administrative dashboard overview",
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to your admin dashboard overview.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Questions</CardTitle>
            <FileQuestion className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,350</div>
            <p className="text-xs text-muted-foreground">
              +180 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,284</div>
            <p className="text-xs text-muted-foreground">
              +10% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Image Library</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">4,832</div>
            <p className="text-xs text-muted-foreground">
              +240 new images
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">76%</div>
            <p className="text-xs text-muted-foreground">
              +2.4% from last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      <div className="grid gap-4 md:grid-cols-7">
        {/* Activity Feed */}
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest actions across the platform</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="space-y-4">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="questions">Questions</TabsTrigger>
                <TabsTrigger value="users">Users</TabsTrigger>
                <TabsTrigger value="feedback">Feedback</TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="space-y-4">
                <div className="flex items-start gap-4 rounded-lg border p-4">
                  <AlertCircle className="h-5 w-5 mt-0.5 text-amber-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Question Needs Review</p>
                    <p className="text-sm text-muted-foreground">
                      A new question about renal pathology requires moderation
                    </p>
                    <div className="flex items-center pt-2">
                      <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">2 hours ago</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-lg border p-4">
                  <CheckCircle2 className="h-5 w-5 mt-0.5 text-emerald-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">User Verification Complete</p>
                    <p className="text-sm text-muted-foreground">
                      Dr. Sarah Wilson's account has been verified
                    </p>
                    <div className="flex items-center pt-2">
                      <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">4 hours ago</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-lg border p-4">
                  <AlertCircle className="h-5 w-5 mt-0.5 text-amber-500" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Content Reported</p>
                    <p className="text-sm text-muted-foreground">
                      User reported an issue with question #1234
                    </p>
                    <div className="flex items-center pt-2">
                      <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">6 hours ago</span>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/admin/questions/review" className="block">
              <Button variant="outline" className="w-full justify-between">
                Review Pending Questions
                <div className="flex items-center">
                  <span className="mr-2 text-sm text-muted-foreground">12</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Button>
            </Link>
            <Link href="/admin/users/verify" className="block">
              <Button variant="outline" className="w-full justify-between">
                Verify New Users
                <div className="flex items-center">
                  <span className="mr-2 text-sm text-muted-foreground">5</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Button>
            </Link>
            <Link href="/admin/feedback" className="block">
              <Button variant="outline" className="w-full justify-between">
                Review User Feedback
                <div className="flex items-center">
                  <span className="mr-2 text-sm text-muted-foreground">8</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              </Button>
            </Link>
            <Link href="/admin/images/upload" className="block">
              <Button variant="outline" className="w-full justify-between">
                Upload New Images
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Users */}
        <Card className="md:col-span-4">
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>Latest user registrations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border p-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Dr. John Smith</p>
                      <p className="text-xs text-muted-foreground">Resident - Pathology</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    View Profile
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Platform health overview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Server Status</p>
                  <div className="flex items-center">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 mr-2" />
                    <p className="text-sm text-muted-foreground">Operational</p>
                  </div>
                </div>
                <p className="text-sm font-medium text-emerald-500">99.9%</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Response Time</p>
                  <p className="text-sm text-muted-foreground">Average</p>
                </div>
                <p className="text-sm font-medium">124ms</p>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">Active Sessions</p>
                  <p className="text-sm text-muted-foreground">Current</p>
                </div>
                <p className="text-sm font-medium">243</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}