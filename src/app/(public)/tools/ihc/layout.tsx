import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "IHC Panel Builder",
  description:
    "Evidence-based immunohistochemistry decision support: compare differential diagnoses, rank the antibodies that best discriminate between them, and see per-marker positivity rates with primary references.",
  keywords: [
    "immunohistochemistry",
    "IHC panel",
    "antibody panel",
    "differential diagnosis",
    "immunostains",
    "positivity rates",
  ],
  url: "/tools/ihc",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
