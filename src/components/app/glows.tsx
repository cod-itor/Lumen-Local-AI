/** Two soft blurred glows from the Desktop App frames (Figma "Glow" ellipses). */
export function AppGlows() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* bottom-left orange: 340px circle, gaussian blur 60 */}
      <div
        className="absolute size-[340px] rounded-full bg-brand-orange-soft blur-[60px]"
        style={{ left: -140, bottom: -100 }}
      />
      {/* top-right blue: 300px circle, gaussian blur 55 */}
      <div
        className="absolute size-[300px] rounded-full bg-brand-blue-soft blur-[55px]"
        style={{ right: -60, top: -100 }}
      />
    </div>
  );
}
