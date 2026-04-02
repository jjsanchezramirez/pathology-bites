import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "GenoVA - Genomic Variant Analyzer",
  description:
    "Analyze genomic variants with the GenoVA tool. Classify variants according to ACMG/AMP guidelines for clinical pathology.",
  keywords: ["genomic variant", "variant classification", "ACMG guidelines", "molecular pathology"],
  url: "/tools/genova",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
