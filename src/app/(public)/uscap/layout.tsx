import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";
import { USCAPLayoutClient } from "./uscap-layout-client";

export const metadata: Metadata = generateMetadata({
  title: "USCAP Demo - Pathology Bites",
  description:
    "Try Pathology Bites for free. Take demo quizzes, explore virtual slides, and practice with AI-powered pathology questions.",
  keywords: ["USCAP", "pathology demo", "free pathology quiz", "virtual slides demo"],
  url: "/uscap",
});

export default function USCAPLayout({ children }: { children: React.ReactNode }) {
  return <USCAPLayoutClient>{children}</USCAPLayoutClient>;
}
