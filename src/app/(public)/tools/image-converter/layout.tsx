import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "Image Converter",
  description:
    "Convert TIFF, PNG, JPEG, WebP and AVIF images in your browser. Batch conversion with resizing — nothing is uploaded, every file stays on your computer.",
  keywords: [
    "tiff to png",
    "image converter",
    "batch image conversion",
    "convert tiff",
    "browser image converter",
  ],
  url: "/tools/image-converter",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
