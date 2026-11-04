import { Cta } from "@/components/landing/cta";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Hero } from "@/components/landing/hero";
import { HeroPreview } from "@/components/landing/hero-preview";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Glow } from "@/components/landing/motion";
import { RunsLocally } from "@/components/landing/runs-locally";
import { TopNav } from "@/components/landing/top-nav";
import { getLandingContent } from "@/services/landing";

export default async function Home() {
  const content = await getLandingContent();

  return (
    <div className="relative flex-1 overflow-x-clip">
      {/* Background glows (Figma ellipses 6:108–6:112), positioned on the 1440 frame */}
      <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 w-[1440px] -translate-x-1/2">
        <Glow tone="blue" className="top-[180px] left-[180px] h-[480px] w-[520px]" blur={120} />
        <Glow tone="orange" className="top-[260px] left-[760px] h-[500px] w-[560px]" blur={120} duration={22} />
        <Glow tone="orange" className="top-[1700px] left-[-200px] size-[520px]" blur={120} duration={20} />
        <Glow tone="blue" className="top-[2300px] left-[1100px] size-[520px]" blur={120} duration={24} />
        <Glow tone="blue" className="top-[3300px] left-[300px] h-[500px] w-[600px]" blur={120} duration={26} />
      </div>

      <TopNav links={content.nav} />
      <main className="relative">
        <Hero hero={content.hero} />
        <HeroPreview preview={content.preview} />
        <Features features={content.features} />
        <HowItWorks steps={content.steps} />
        <RunsLocally privacy={content.privacy} />
        <Cta cta={content.cta} />
      </main>
      <Footer footer={content.footer} />
    </div>
  );
}
