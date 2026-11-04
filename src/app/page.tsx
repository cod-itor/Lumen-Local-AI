import { LandingView } from "@/components/landing/landing-view";
import { Glow } from "@/components/landing/motion";
import { CursorSpotlight } from "@/components/landing/pointer-effects";
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
        <Glow tone="blue" className="top-[2900px] left-[1100px] size-[520px]" blur={120} duration={24} />
        <Glow tone="blue" className="top-[4300px] left-[300px] h-[500px] w-[600px]" blur={120} duration={26} />
      </div>

      <CursorSpotlight />
      <LandingView bundle={content} />
    </div>
  );
}
