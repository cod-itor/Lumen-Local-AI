import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const wsOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_WS_URL ?? "").origin;
  } catch {
    return "";
  }
})();

/** Security headers (docs/FRONTEND.md §9). WebLLM downloads from Hugging Face + GitHub; Ollama is on localhost. */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  [
    "connect-src 'self' http://localhost:* http://127.0.0.1:*",
    "https://huggingface.co https://cdn-lfs.huggingface.co https://cdn-lfs-us-1.huggingface.co https://cdn-lfs-us-1.hf.co",
    "https://cas-bridge.xethub.hf.co https://raw.githubusercontent.com",
    dev ? "ws://localhost:* ws://127.0.0.1:*" : "",
    wsOrigin,
  ]
    .filter(Boolean)
    .join(" "),
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Permissions-Policy", value: "microphone=(self), camera=()" },
        ],
      },
    ];
  },
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
