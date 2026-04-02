import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "Slide-Based Questions",
  description:
    "Generate AI-powered pathology questions from whole slide images. Practice diagnostic skills with interactive virtual microscopy.",
  keywords: ["whole slide images", "WSI questions", "virtual microscopy", "pathology slides"],
  url: "/uscap/wsi-questions",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
