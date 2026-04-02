import { Metadata } from "next";
import { generateHomePageMetadata } from "@/shared/components/seo/page-seo";
import { LandingPage } from "./landing-page";

export const metadata: Metadata = generateHomePageMetadata();

export default function Page() {
  return <LandingPage />;
}
