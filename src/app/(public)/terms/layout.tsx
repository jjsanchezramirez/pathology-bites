import { Metadata } from "next";
import { generateTermsPageMetadata } from "@/shared/components/seo/page-seo";

export const metadata: Metadata = generateTermsPageMetadata();

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
