// src/app/(public)/uscap/page.tsx
"use client";

import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Plus, Microscope, BookText, Target, Layers } from "lucide-react";
import Link from "next/link";
import { PageErrorBoundary, ScrollReveal } from "@/shared/components/common";

const guestActivities = [
  {
    id: "1",
    type: "quiz",
    title: "Take a Demo Quiz",
    description:
      "Configure and take a quiz with real pathology questions - get instant feedback with detailed explanations",
    navigationUrl: "/uscap/quiz",
    icon: Plus,
  },
  {
    id: "2",
    type: "slides-questions",
    title: "Slide-Based Questions",
    description:
      "Practice with whole-slide image questions featuring interactive virtual microscopy",
    navigationUrl: "/uscap/wsi-questions",
    icon: Layers,
  },
  {
    id: "3",
    type: "slides",
    title: "Search Virtual Slides",
    description:
      "Browse 10,000+ pathology slides from 8 major repositories with smart search and filtering",
    navigationUrl: "/tools/virtual-slides",
    icon: Microscope,
  },
  {
    id: "4",
    type: "hemapath",
    title: "Hematopathology Cell Quiz",
    description: "Test your cell identification skills with an interactive hematopathology quiz",
    navigationUrl: "/tools/cell-quiz",
    icon: Target,
  },
  {
    id: "5",
    type: "content",
    title: "ABPath Content Specifications",
    description:
      "Interactive exam content specifications with filtering by Core/AR/Fellow and PDF export",
    navigationUrl: "/tools/abpath",
    icon: BookText,
  },
];

// Guest version of recent activity component
function GuestRecentActivity({ activities }: { activities: typeof guestActivities }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Try These Features</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activities.map((activity) => {
            const IconComponent = activity.icon;
            return (
              <Link key={activity.id} href={activity.navigationUrl}>
                <div className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="rounded-full bg-primary/10 p-2">
                    <IconComponent className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium hover:underline">{activity.title}</div>
                    <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function USCAPDashboardPage() {
  return (
    <PageErrorBoundary pageName="USCAP Dashboard" showHomeButton={false} showBackButton={false}>
      <div className="space-y-6">
        {/* Welcome Banner for USCAP Attendees */}
        <ScrollReveal animation="fade-up">
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight">Welcome, USCAP Attendee!</h1>
                  <Badge className="bg-primary">USCAP 2026</Badge>
                </div>
                <p className="text-muted-foreground max-w-2xl">
                  Explore everything Pathology Bites has to offer — take quizzes with real
                  board-style questions, browse thousands of virtual slides, and sharpen your
                  diagnostic skills. No account needed to get started.
                </p>
                <div className="flex gap-3 mt-1">
                  <Link href="/uscap/quiz">
                    <Button>Start a Quiz</Button>
                  </Link>
                  <Link href="/signup">
                    <Button variant="outline">Create Free Account</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Try These Features */}
        <ScrollReveal animation="fade-up">
          <GuestRecentActivity activities={guestActivities} />
        </ScrollReveal>

        {/* Sign Up CTA */}
        <ScrollReveal animation="fade-up">
          <Card className="bg-gradient-to-br from-primary/5 to-background">
            <CardHeader>
              <CardTitle>Unlock the Full Experience</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Track your progress, compete on leaderboards, earn achievements, and access
                personalized analytics — all free.
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
