import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "USCAP Demo Quiz",
  description:
    "Try a free demo pathology quiz. Test your knowledge with practice questions covering anatomic and clinical pathology topics.",
  keywords: ["USCAP", "pathology quiz", "demo quiz", "practice questions"],
  url: "/uscap/quiz",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
