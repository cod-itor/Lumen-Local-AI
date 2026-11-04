import Link from "next/link";
import { Icon } from "@/components/icon";
import type { LandingContent } from "@/types/landing";
import { Glow, Reveal } from "./motion";
import { Container } from "./primitives";

const onPrimary = (pct: number) => `color-mix(in srgb, var(--primary-fill-foreground) ${pct}%, transparent)`;

export function Cta({ cta }: { cta: LandingContent["cta"] }) {
  return (
    <section className="px-4 pt-24 sm:px-8 lg:pt-[140px] xl:px-0">
      <Container>
        <Reveal className="bg-primary-fill relative flex flex-col items-center gap-5 overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-16 sm:py-[72px]">
          <Glow tone="blue" blur={90} drift={30} className="top-[120px] left-[-80px] h-[320px] w-[420px] opacity-90" />
          <Glow
            tone="orange"
            blur={90}
            drift={30}
            duration={22}
            className="top-[-120px] left-[900px] h-[360px] w-[460px] opacity-90"
          />
          <h2 className="relative text-[32px] leading-[1.15] font-semibold tracking-[-1px] sm:text-[40px] lg:text-[46px] lg:leading-[normal] lg:tracking-[-1.15px]">
            {cta.title}
          </h2>
          <p className="relative text-base text-faint sm:text-[18px] sm:leading-[normal]">{cta.subtitle}</p>
          <div className="relative flex flex-col items-center gap-3 pt-2.5 sm:flex-row">
            <Link
              href={cta.primary.href}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground px-[26px] py-4 text-base leading-[normal] font-medium text-primary transition-transform hover:-translate-y-0.5"
            >
              {cta.primary.label}
              <Icon name="landing-arrow" size={17} />
            </Link>
            <Link
              href={cta.secondary.href}
              className="inline-flex items-center rounded-full border px-[26px] py-4 text-base leading-[normal] font-medium transition-transform hover:-translate-y-0.5"
              style={{ backgroundColor: onPrimary(10), borderColor: onPrimary(25) }}
            >
              {cta.secondary.label}
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
