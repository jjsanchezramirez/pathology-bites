import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "FAQ - Frequently Asked Questions",
  description:
    "Find answers to common questions about Pathology Bites, our practice questions, study materials, and how to get the most out of your pathology education.",
  url: "/faq",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
