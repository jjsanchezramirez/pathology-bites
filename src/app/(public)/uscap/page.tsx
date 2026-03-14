// src/app/(public)/uscap/page.tsx
"use client";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Plus, Microscope, BookText, Calculator, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { StudentStatsCards } from "@/features/user/dashboard/components";
import { PageErrorBoundary, ScrollReveal } from "@/shared/components/common";

const guestActivities = [
  {
    id: "1",
    type: "quiz",
    title: "Take a Demo Quiz",
    description:
      "Configure and take a quiz with real pathology questions - get instant feedback with detailed explanations",
    timestamp: new Date().toISOString(),
    navigationUrl: "/uscap/quiz",
  },
  {
    id: "2",
    type: "slides",
    title: "Search Virtual Slides",
    description:
      "Browse 10,000+ pathology slides from 8 major repositories with smart search and filtering",
    timestamp: new Date().toISOString(),
    navigationUrl: "/tools/virtual-slides",
  },
  {
    id: "3",
    type: "content",
    title: "ABPath Content Specifications",
    description:
      "Interactive exam content specifications with filtering by Core/AR/Fellow and PDF export",
    timestamp: new Date().toISOString(),
    navigationUrl: "/tools/abpath",
  },
  {
    id: "4",
    type: "tools",
    title: "Clinical Tools",
    description:
      "Professional cell counter with Epic EMR integration, gene lookup (MILAN), and lab calculators",
    timestamp: new Date().toISOString(),
    navigationUrl: "/tools/cell-counter",
  },
];

// Guest version of recent activity component
function GuestRecentActivity({ activities }: { activities: typeof guestActivities }) {
  return (
    <Card className="md:col-span-4">
      <CardHeader>
        <CardTitle>Try These Features</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <Link key={activity.id} href={activity.navigationUrl}>
              <div className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="rounded-full bg-primary/10 p-2">
                  {activity.type === "quiz" && <Plus className="h-5 w-5 text-primary" />}
                  {activity.type === "slides" && <Microscope className="h-5 w-5 text-primary" />}
                  {activity.type === "content" && <BookText className="h-5 w-5 text-primary" />}
                  {activity.type === "tools" && <Calculator className="h-5 w-5 text-primary" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium hover:underline">{activity.title}</div>
                  <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                  <div className="flex gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      No signup required
                    </Badge>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Guest version of quick actions (override some links)
function GuestQuickActions() {
  return (
    <Card className="md:col-span-3">
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Link href="/uscap/quiz" className="block">
          <Button className="w-full justify-between">
            Start Demo Quiz
            <Plus className="h-4 w-4" />
          </Button>
        </Link>

        <Link href="/tools/virtual-slides" className="block">
          <Button variant="outline" className="w-full justify-between">
            Browse Virtual Slides
            <Microscope className="h-4 w-4" />
          </Button>
        </Link>

        <Link href="/tools/abpath" className="block">
          <Button variant="outline" className="w-full justify-between">
            ABPath Content
            <BookText className="h-4 w-4" />
          </Button>
        </Link>

        <Link href="/tools/cell-counter" className="block">
          <Button variant="outline" className="w-full justify-between">
            Cell Counter
            <Calculator className="h-4 w-4" />
          </Button>
        </Link>

        <Link href="/tools/milan" className="block">
          <Button variant="outline" className="w-full justify-between">
            Gene Lookup (MILAN)
            <Search className="h-4 w-4" />
          </Button>
        </Link>

        {/* Sign Up CTA */}
        <div className="pt-4 border-t">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg p-4 mb-3">
            <div className="text-sm">
              <p className="font-medium text-primary mb-1">Want to Save Progress?</p>
              <p className="text-muted-foreground text-xs">
                Sign up free to track your learning and earn achievements
              </p>
            </div>
          </div>
          <Link href="/signup" className="block">
            <Button variant="default" className="w-full">
              Sign Up Free
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function USCAPDashboardPage() {
  const [guestStats, setGuestStats] = useState({
    needsReview: 0,
    mastered: 0,
    unused: 0,
    completedQuestions: 0,
  });

  useEffect(() => {
    // Fetch real question count from the API
    async function fetchQuestionCount() {
      try {
        const response = await fetch("/api/public/uscap/init");
        if (response.ok) {
          const data = await response.json();
          setGuestStats({
            needsReview: 0,
            mastered: 0,
            unused: data.data.questionTypeStats.all.all,
            completedQuestions: 0,
          });
        }
      } catch (error) {
        console.error("Error fetching question count:", error);
      }
    }
    fetchQuestionCount();
  }, []);

  return (
    <PageErrorBoundary pageName="USCAP Dashboard" showHomeButton={false} showBackButton={false}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Dashboard <Badge className="ml-2 bg-primary">USCAP 2026 Demo</Badge>
          </h1>
          <p className="text-muted-foreground">
            Experience the full Pathology Bites platform - no signup required!
          </p>
        </div>

        {/* Stats Cards - Using actual component with real data */}
        <ScrollReveal animation="fade-up">
          <StudentStatsCards stats={guestStats} />
        </ScrollReveal>

        {/* Recent Activity Section */}
        <ScrollReveal animation="fade-up">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <GuestRecentActivity activities={guestActivities} />
            <GuestQuickActions />
          </div>
        </ScrollReveal>

        {/* Optional: Add performance analytics placeholder */}
        <ScrollReveal animation="fade-up">
          <Card>
            <CardHeader>
              <CardTitle>Sign Up to See Your Performance Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Create a free account to track your performance, see how you compare with peers, and
                identify areas for improvement.
              </p>
              <Link href="/signup">
                <Button>Create Free Account</Button>
              </Link>
            </CardContent>
          </Card>
        </ScrollReveal>
      </div>
    </PageErrorBoundary>
  );
}
