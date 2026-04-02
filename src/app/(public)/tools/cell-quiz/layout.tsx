import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "Cell Identification Quiz",
  description:
    "Test your cell identification skills with interactive quizzes. Practice identifying cells in histopathology and cytopathology images.",
  keywords: ["cell identification", "cell quiz", "histopathology quiz", "cytopathology quiz"],
  url: "/tools/cell-quiz",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
