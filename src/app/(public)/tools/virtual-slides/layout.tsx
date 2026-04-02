import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "Virtual Pathology Slides - Interactive Learning",
  description:
    "Explore virtual pathology slides from leading medical institutions. Interactive microscopy for enhanced pathology education.",
  keywords: [
    "virtual pathology slides",
    "digital pathology",
    "interactive microscopy",
    "virtual slides",
  ],
  url: "/tools/virtual-slides",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
