import { Metadata } from "next";
import { generatePrivacyPageMetadata } from "@/shared/components/seo/page-seo";

export const metadata: Metadata = generatePrivacyPageMetadata();

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
