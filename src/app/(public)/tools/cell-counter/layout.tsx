import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "Cell Counter",
  description:
    "Digital cell counter for differential counts. Track and tally cell types during manual microscopy review with keyboard shortcuts.",
  keywords: ["cell counter", "differential count", "manual cell count", "hematopathology"],
  url: "/tools/cell-counter",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
