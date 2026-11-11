/**
 * Demo mode switch. Build or run with NEXT_PUBLIC_LUMEN_DEMO=1 (`npm run dev:demo`, `npm run build:demo`, or the
 * Vercel project's environment variable) and every /api call is answered inside the browser by `lib/demo/server.ts`:
 * same UI, same flows, sample answers, data kept in this browser's localStorage. Without it nothing here is used.
 */
export const DEMO = process.env.NEXT_PUBLIC_LUMEN_DEMO === "1";

/** The demo's own "signed in" cookie (never the real `session_hint`, which other localhost ports share). */
export const DEMO_COOKIE = "lumen_demo_session";

/** Built-in demo login; created on first sign-in in each browser (shown on the login page in demo mode). */
export const DEMO_ACCOUNT = { name: "Demo Student", email: "test", password: "123" };
