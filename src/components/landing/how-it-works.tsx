import type { LandingContent } from "@/types/landing";
import { DrawLine, SpotlightCard } from "./effects";
import { LiftCard, Reveal } from "./motion";
import { Container, Eyebrow, SectionTitle } from "./primitives";

export function HowItWorks({ steps }: { steps: LandingContent["steps"] }) {
  return (
    <section id="how-it-works" className="scroll-mt-24 px-4 pt-24 sm:px-8 lg:pt-[140px] xl:px-0">
      <Container className="flex flex-col items-center gap-[18px]">
        <Reveal className="flex flex-col items-center gap-[18px]">
          <Eyebrow>{steps.eyebrow}</Eyebrow>
          <SectionTitle>{steps.title}</SectionTitle>
        </Reveal>

        <div className="relative grid w-full grid-cols-1 gap-5 pt-[30px] md:grid-cols-3">
          {/* connector that draws across the three steps */}
          <DrawLine className="absolute top-[86px] right-[6%] left-[6%] hidden md:block" />
          {steps.items.map((s, i) => (
            <Reveal key={s.number} delay={i * 0.06}>
              <SpotlightCard className="rounded-2xl">
              <LiftCard className="glass flex h-full flex-col items-start gap-3 rounded-2xl p-[30px]">
                <span className="bg-linear-to-r from-brand-blue-strong to-brand-orange-strong bg-clip-text text-[44px] leading-[normal] font-semibold tracking-[-0.88px] text-transparent">
                  {s.number}
                </span>
                <h3 className="text-[20px] leading-[normal] font-semibold tracking-[-0.2px] text-foreground">{s.title}</h3>
                <p className="text-[15px] leading-[22px] text-muted-foreground">{s.description}</p>
              </LiftCard>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
