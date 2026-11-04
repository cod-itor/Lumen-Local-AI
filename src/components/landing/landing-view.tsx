"use client";

import type { Localized } from "@/i18n/config";
import { useLocalized } from "@/i18n/provider";
import type { LandingContent } from "@/types/landing";
import { Cta } from "./cta";
import { Features } from "./features";
import { Footer } from "./footer";
import { Hero } from "./hero";
import { HowItWorks } from "./how-it-works";
import { RunsLocally } from "./runs-locally";
import { Showcase } from "./showcase";
import { TopNav } from "./top-nav";

/** Landing sections in the visitor's language (switchable in the nav and hero). */
export function LandingView({ bundle }: { bundle: Localized<LandingContent> }) {
  const content = useLocalized(bundle);
  return (
    <>
      <TopNav links={content.nav} ui={content.ui} />
      <main className="relative">
        <Hero hero={content.hero} />
        <Showcase preview={content.preview} showcase={content.showcase} />
        <Features features={content.features} />
        <HowItWorks steps={content.steps} />
        <RunsLocally privacy={content.privacy} />
        <Cta cta={content.cta} />
      </main>
      <Footer footer={content.footer} />
    </>
  );
}
