import { Metadata } from "next";
import { generateMetadata } from "@/shared/utils/seo";

export const metadata: Metadata = generateMetadata({
  title: "Contact Us",
  description:
    "Get in touch with the Pathology Bites team. Report issues, suggest features, or ask questions about our free pathology education platform.",
  url: "/contact",
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
