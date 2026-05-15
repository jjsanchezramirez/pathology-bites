import { Badge } from "@/shared/components/ui/badge";
import { Clock, CheckCircle, AlertCircle } from "lucide-react";

interface InquiryStatusBadgeProps {
  status: string;
  createdAt?: string;
  className?: string;
}

export function InquiryStatusBadge({ status, createdAt, className }: InquiryStatusBadgeProps) {
  const isDelayed = (createdAt: string) => {
    const inquiryDate = new Date(createdAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return inquiryDate < sevenDaysAgo;
  };

  const getStatusConfig = (status: string) => {
    const statusLower = status.toLowerCase();

    if (statusLower === "resolved" || statusLower === "closed") {
      return {
        label: statusLower === "resolved" ? "Resolved" : "Closed",
        icon: CheckCircle,
        className: "border-emerald-300 bg-emerald-50 text-emerald-700",
      };
    }

    if (statusLower === "pending") {
      const delayed = createdAt && isDelayed(createdAt);
      if (delayed) {
        return {
          label: "Delayed",
          icon: AlertCircle,
          className: "border-red-300 bg-red-50 text-red-700",
        };
      }
      return {
        label: "Pending",
        icon: Clock,
        className: "border-amber-300 bg-amber-50 text-amber-700",
      };
    }

    return {
      label: status,
      icon: Clock,
      className: "border-gray-300 bg-gray-50 text-gray-700",
    };
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={`${config.className} ${className ?? ""}`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
}

// Helper function to get status sort order for "All Inquiries" tab
export function getStatusSortOrder(status: string, createdAt: string): number {
  const statusLower = status.toLowerCase();

  // Check if pending inquiry is delayed (>7 days old)
  const isDelayed = () => {
    const inquiryDate = new Date(createdAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return inquiryDate < sevenDaysAgo;
  };

  // Red (Delayed) = 0, Yellow (Pending) = 1, Green (Resolved/Closed) = 2
  if (statusLower === "pending" && isDelayed()) {
    return 0; // Red - Delayed
  }
  if (statusLower === "pending") {
    return 1; // Yellow - Pending
  }
  if (statusLower === "resolved" || statusLower === "closed") {
    return 2; // Green - Resolved/Closed
  }

  return 3; // Unknown
}
