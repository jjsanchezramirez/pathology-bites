import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "Pathology Image Library",
  description:
    "Browse and search a curated library of pathology images for education and reference. High-quality histopathology and cytopathology images.",
  keywords: [
    "pathology images",
    "histopathology images",
    "cytopathology images",
    "pathology atlas",
  ],
  url: "/tools/images",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
