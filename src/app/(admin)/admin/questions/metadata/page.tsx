// src/app/(admin)/admin/questions/metadata/page.tsx
import { Metadata } from "next";
import { QuestionManagementTable } from "@/features/questions/components/question-management-table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export const metadata: Metadata = {
  title: "Question Metadata - Admin Dashboard",
  description: "Manage question tags, categories, and sets",
};

export default function QuestionMetadataPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Question Metadata</h1>
        <p className="text-muted-foreground">
          Manage tags, categories, and question sets to organize your question bank
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Tools</CardTitle>
          <CardDescription>
            Create and manage tags, categories, and question sets to organize your questions
            effectively
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionManagementTable />
        </CardContent>
      </Card>
    </div>
  );
}
