import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "ABPath - Anatomic & Body Pathology Reference",
  description:
    "Comprehensive anatomic and body pathology reference tool. Browse pathology topics organized by organ system and specialty.",
  keywords: ["anatomic pathology", "body pathology", "pathology reference", "organ pathology"],
  url: "/tools/abpath",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
