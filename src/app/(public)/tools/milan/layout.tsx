import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "Milan System Calculator",
  description:
    "Interactive Milan System for Reporting Salivary Gland Cytopathology calculator. Determine risk of malignancy and recommended management.",
  keywords: [
    "Milan system",
    "salivary gland cytopathology",
    "cytopathology calculator",
    "risk of malignancy",
  ],
  url: "/tools/milan",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
