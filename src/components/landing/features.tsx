import Link from "next/link";
import { Icon } from "@/components/icon";
import type { LandingContent } from "@/types/landing";
import { SpotlightCard } from "./effects";
import { LiftCard, Reveal } from "./motion";
import { Container, Eyebrow, GlassChip, SectionTitle } from "./primitives";

export function Features({ features }: { features: LandingContent["features"] }) {
  return (
    <section id="features" className="scroll-mt-24 px-4 pt-24 sm:px-8 lg:pt-[140px] xl:px-0">
      <Container className="flex flex-col items-center gap-[18px]">
        <Reveal className="flex flex-col items-center gap-[18px]">
          <Eyebrow>{features.eyebrow}</Eyebrow>
          <SectionTitle>{features.title}</SectionTitle>
          <p className="max-w-[620px] text-center text-[16px] leading-[25px] text-muted-foreground sm:text-[18px] sm:leading-[27px]">
            {features.subtitle}
          </p>
        </Reveal>

        <div className="grid w-full grid-cols-1 gap-5 pt-[30px] sm:grid-cols-2 lg:grid-cols-4">
          {features.items.map((f, i) => (
            <Reveal key={f.id} delay={i * 0.06}>
              <LiftCard className="h-full">
                <SpotlightCard className="rounded-2xl">
                <Link
                  href={f.href}
                  className="glass flex h-full flex-col items-start gap-[14px] rounded-2xl px-[26px] py-7 transition-shadow hover:shadow-device lg:h-[308.8px]"
                >
                  <span className="bg-tint-gradient flex size-[52px] items-center justify-center rounded-lg border-[1.5px] border-border-glass text-foreground">
                    <Icon name={f.icon} size={22} />
                  </span>
                  <span aria-hidden className="size-1" />
                  <h3 className="text-[20px] leading-[normal] font-semibold tracking-[-0.2px] text-foreground">
                    {f.title}
                  </h3>
                  <p className="text-[15px] leading-[22px] text-muted-foreground">{f.description}</p>
                  <GlassChip className="px-3 py-[5px] text-[11.5px] leading-[normal] font-medium">{f.chip}</GlassChip>
                </Link>
                </SpotlightCard>
              </LiftCard>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
