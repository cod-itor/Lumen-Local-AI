export const EASE = [0.22, 1, 0.36, 1] as const;

/** Thread items / gallery tiles: fade + rise. */
export const riseItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } },
};
