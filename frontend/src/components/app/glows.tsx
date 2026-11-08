/**
 * Two soft glows from the Desktop App frames (Figma "Glow" ellipses: blur 55–60).
 * Drawn as radial gradients instead of CSS blur() filters — same look, but no
 * filter for the GPU to render (matters on phones and small laptops).
 */
export function AppGlows() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute size-[580px]"
        style={{
          left: -260,
          bottom: -220,
          backgroundImage: "radial-gradient(closest-side, var(--brand-orange-soft) 30%, transparent 100%)",
        }}
      />
      <div
        className="absolute size-[520px]"
        style={{
          right: -170,
          top: -210,
          backgroundImage: "radial-gradient(closest-side, var(--brand-blue-soft) 30%, transparent 100%)",
        }}
      />
    </div>
  );
}
