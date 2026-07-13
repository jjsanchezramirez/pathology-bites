"use client";

import { PublicHero } from "@/shared/components/common/public-hero";
import { JoinCommunitySection } from "@/shared/components/common/join-community-section";
import { IhcPanelTool } from "@/features/public/tools/ihc/components/ihc-panel-tool";

export default function IhcPanelPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHero
        title="IHC Panel Builder"
        description="Compare differential diagnoses and find the antibodies that best confirm — or exclude — each one, with per-marker positivity rates and primary references."
      />

      <section className="relative py-8">
        <div className="flex items-center justify-center p-2 md:p-4">
          <IhcPanelTool />
        </div>
      </section>

      <div className="flex-1" />

      <JoinCommunitySection description="Start your learning journey today. No fees, no subscriptions - just high-quality pathology education available to everyone." />
    </div>
  );
}
