import { type ReactNode } from "react";
import { AlertTriangle, Clock, CheckCircle2, FileText, Flag } from "lucide-react";

const EMPTY_CONFIG: Record<string, { icon: ReactNode; heading: string; message: string }> = {
  revision: {
    icon: <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />,
    heading: "No questions need revision",
    message: "Great work! You have no rejected questions to revise.",
  },
  flagged: {
    icon: <Flag className="h-12 w-12 mx-auto mb-4 text-orange-500" />,
    heading: "No flagged questions",
    message: "Questions flagged by reviewers will appear here",
  },
  drafts: {
    icon: <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />,
    heading: "No drafts yet",
    message: "Create a new question to get started",
  },
  "under-review": {
    icon: <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />,
    heading: "Nothing under review",
    message: "Submit draft questions to see them here",
  },
  published: {
    icon: <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />,
    heading: "No published questions",
    message: "Questions appear here once approved by reviewers",
  },
};

export function MyQuestionsEmptyState({
  activeTab,
  hasFilters,
}: {
  activeTab: string;
  hasFilters: boolean;
}) {
  const config = EMPTY_CONFIG[activeTab];
  if (!config) return null;

  return (
    <div className="text-center py-6">
      {config.icon}
      <h3 className="text-lg font-medium mb-2">{config.heading}</h3>
      <p className="text-muted-foreground">
        {hasFilters ? "No questions match your filters" : config.message}
      </p>
    </div>
  );
}
