import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "Lupus Anticoagulant Interpreter",
  description:
    "Interpret lupus anticoagulant test results with this interactive tool. Evaluate mixing studies, dRVVT, and other coagulation assays.",
  keywords: ["lupus anticoagulant", "coagulation", "dRVVT", "mixing studies", "hematopathology"],
  url: "/tools/lupus-anticoagulant",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
