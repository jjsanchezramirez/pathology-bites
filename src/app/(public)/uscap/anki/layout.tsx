import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "USCAP Anki Flashcards",
  description:
    "Study pathology with Anki-style flashcards. Review key concepts with spaced repetition for effective learning.",
  keywords: ["Anki", "pathology flashcards", "spaced repetition", "pathology review"],
  url: "/uscap/anki",
});

export default function USCAPAnkiLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full">{children}</div>;
}
