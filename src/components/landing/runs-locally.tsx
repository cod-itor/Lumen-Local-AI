import { CountUp } from "./effects";
import { Fragment } from "react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { LandingContent } from "@/types/landing";
import { Reveal } from "./motion";
import { Container, Eyebrow } from "./primitives";

/** Translucent layer tinted with the primary-fill foreground (inverts with theme). */
const onPrimary = (pct: number) => `color-mix(in srgb, var(--primary-fill-foreground) ${pct}%, transparent)`;

export function RunsLocally({ privacy }: { privacy: LandingContent["privacy"] }) {
  return (
    <section id="privacy" className="scroll-mt-24 px-4 pt-24 sm:px-8 lg:pt-[140px] xl:px-0">
      <Container>
        <Reveal className="glass flex flex-col gap-10 rounded-3xl p-6 sm:p-10 lg:flex-row lg:items-center lg:gap-14 lg:p-14">
          <div className="flex min-w-0 flex-1 flex-col items-start gap-5">
            <Eyebrow>{privacy.eyebrow}</Eyebrow>
            <h2 className="text-[36px] leading-[42px] font-semibold tracking-[-1px] text-foreground sm:text-[48px] sm:leading-[54px] sm:tracking-[-1.2px]">
              {privacy.title[0]}
              <br />
              {privacy.title[1]}
            </h2>
            <p className="text-[17px] leading-[26px] text-muted-foreground">{privacy.body}</p>

            <ul className="flex flex-col gap-[14px] pt-1.5">
              {privacy.points.map((pt) => (
                <li key={pt} className="flex items-start gap-2.5 sm:items-center">
                  <span className="bg-primary-fill mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-full sm:mt-0">
                    <Icon name="landing-tick" size={10} />
                  </span>
                  <span className="text-[15px] leading-[normal] text-foreground-secondary">{pt}</span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap gap-3 pt-2.5">
              {privacy.stats.map((s) => (
                <div key={s.label} className="glass flex flex-col gap-0.5 rounded-[18px] px-[18px] py-[14px]">
                  <CountUp
                    value={s.value}
                    className="text-[26px] leading-[normal] font-semibold tracking-[-0.39px] text-foreground"
                  />
                  <span className="text-[12.5px] leading-[normal] text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex w-full flex-col items-center gap-2.5 lg:w-[540px] lg:shrink-0">
            {privacy.stack.map((layer, i) => (
              <Fragment key={layer.title}>
                {i > 0 && <Icon name="landing-chevd" size={18} className="text-subtle" />}
                <div
                  className={cn(
                    "flex w-full items-center gap-4 rounded-xl px-5 py-[18px]",
                    layer.models ? "bg-primary-fill" : "glass",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-[14px]",
                      !layer.models && "bg-surface-raised text-foreground",
                    )}
                    style={layer.models ? { backgroundColor: onPrimary(12) } : undefined}
                  >
                    <Icon name={layer.icon} size={20} />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                    <div className="flex flex-col gap-[3px]">
                      <span
                        className={cn("text-base leading-[normal] font-semibold", !layer.models && "text-foreground")}
                      >
                        {layer.title}
                      </span>
                      <span
                        className={cn(
                          "text-[13px] leading-[normal]",
                          layer.models ? "text-faint" : "text-muted-foreground",
                        )}
                      >
                        {layer.description}
                      </span>
                    </div>
                    {layer.models && (
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {layer.models.map((m) => (
                          <span
                            key={m}
                            className="rounded-full border px-2.5 py-[5px] text-[11.5px] leading-[normal] font-medium whitespace-nowrap"
                            style={{ backgroundColor: onPrimary(12), borderColor: onPrimary(18) }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Fragment>
            ))}
            <span className="flex items-center gap-1.5 rounded-full border-[1.2px] border-dashed border-faint px-3.5 py-2.5 text-center text-[12.5px] leading-[normal] font-medium text-muted-foreground">
              <Icon name="globe" size={14} className="shrink-0" />
              {privacy.note}
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
