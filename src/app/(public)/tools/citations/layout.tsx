import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "Citation Generator",
  description:
    "Generate properly formatted citations for pathology references. Supports multiple citation styles for medical and scientific publications.",
  keywords: [
    "citation generator",
    "medical citations",
    "pathology references",
    "bibliography tool",
  ],
  url: "/tools/citations",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
