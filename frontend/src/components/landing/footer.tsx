import { Icon } from "@/components/icon";
import type { LandingContent } from "@/types/landing";
import { Container } from "./primitives";
import { Logo } from "./top-nav";

export function Footer({ footer }: { footer: LandingContent["footer"] }) {
  return (
    <footer id="about" className="relative px-4 sm:px-8 xl:px-0">
      <Container className="flex flex-col items-center gap-8 py-14 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <div className="flex flex-col items-center gap-1.5 md:items-start">
          <Logo />
          <span className="text-[13px] leading-[normal] text-muted-foreground">{footer.tagline}</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-7">
          {footer.links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              {...(l.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="flex items-center gap-1.5 text-[14px] leading-[normal] font-medium text-foreground-tertiary transition-colors hover:text-foreground"
            >
              {l.icon && <Icon name={l.icon} size={15} />}
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex flex-col items-center gap-1 md:items-end">
          <span className="text-[13px] leading-[normal] font-medium text-foreground">{footer.disclaimer}</span>
          <span className="text-[12.5px] leading-[normal] text-muted-foreground">{footer.copyright}</span>
        </div>
      </Container>
    </footer>
  );
}
