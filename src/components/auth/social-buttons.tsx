"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { socialLoginAction } from "@/app/(auth)/actions";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { SocialProvider } from "@/types/auth";

const PROVIDERS: { id: SocialProvider; label: string; icon: string }[] = [
  { id: "google", label: "Google", icon: "auth-google" },
  { id: "apple", label: "Apple", icon: "auth-apple" },
];

export function SocialButtons({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [active, setActive] = useState<SocialProvider | null>(null);
  const [, startTransition] = useTransition();

  const go = (provider: SocialProvider) => {
    setActive(provider);
    startTransition(async () => {
      const res = await socialLoginAction(provider);
      if (res.ok) router.push("/chat");
      else setActive(null);
    });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {PROVIDERS.map((p) => (
        <Button
          key={p.id}
          type="button"
          variant="outline"
          size="lg"
          disabled={disabled || active !== null}
          aria-busy={active === p.id}
          onClick={() => go(p.id)}
          className="glass h-11 rounded-full text-[14.5px] text-foreground shadow-none hover:-translate-y-px"
        >
          {active === p.id ? <Spinner /> : <Icon name={p.icon} size={18} />}
          {p.label}
        </Button>
      ))}
    </div>
  );
}
