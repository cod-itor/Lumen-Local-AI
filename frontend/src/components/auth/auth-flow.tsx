"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { OtpPurpose } from "@/types/auth";

/**
 * Carries the in-progress flow between auth pages (sign up → verify, forgot →
 * verify → reset) in memory, so emails and tokens never go into the URL.
 * Lives in the (auth) layout, which stays mounted while moving between pages.
 */
export type AuthFlow = {
  email: string | null;
  name: string | null;
  purpose: OtpPurpose;
  resetToken: string | null;
};

const initialFlow: AuthFlow = { email: null, name: null, purpose: "signup", resetToken: null };

type AuthFlowContext = {
  flow: AuthFlow;
  setFlow: (next: Partial<AuthFlow>) => void;
  resetFlow: () => void;
  resendCooldownSec: number;
};

const Ctx = createContext<AuthFlowContext | null>(null);

export function AuthFlowProvider({ children, resendCooldownSec }: { children: ReactNode; resendCooldownSec: number }) {
  const [flow, setFlowState] = useState<AuthFlow>(initialFlow);
  const value = useMemo<AuthFlowContext>(
    () => ({
      flow,
      setFlow: (next) => setFlowState((f) => ({ ...f, ...next })),
      resetFlow: () => setFlowState(initialFlow),
      resendCooldownSec,
    }),
    [flow, resendCooldownSec],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuthFlow() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuthFlow must be used inside <AuthFlowProvider>");
  return ctx;
}
