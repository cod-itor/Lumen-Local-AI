# Lumen — Local AI study partner

Static UI for **Lumen**, a private AI study partner that runs locally and speaks
Khmer and English. Built from the LocalAIChatBot Figma file (desktop screens,
light + dark). Data is mocked for now; the API comes later.

## Stack

- Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript
- Tailwind CSS v4 with Figma design tokens (`src/app/globals.css`)
- shadcn/ui on Base UI · lucide-react · motion · next-themes (dark by default)

## Getting started

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint
```

## Routes

| Figma screen | Route |
| --- | --- |
| Landing (light/dark) | `/` |
| 01 Chat · New | `/chat` |
| 02–04 Chat · Answer / Sources open / Sidebar closed + voice | `/chat/[id]` (`?sources=open`) |
| 05 Documents · Material open | `/documents/[id]` |
| 06 Image · Prompt approval | `/image` |
| 07 Image · Generated images | `/image/[id]` |
| 08 Learn · Step + quiz | `/learn` |

## Project structure

```
src/
  app/                 routes ((app)/ = app shell with sidebar + tab bar)
  components/
    app/               shell: sidebar, top bar, composer, right panel
    chat/ documents/ image/ learn/ landing/   screen components
    ui/                shadcn primitives
  mocks/               mock data (replace with API)
  services/            async data access — the only place pages get data from
  types/               shared types for mocks + API
public/icons           Figma-exported SVG icons (rendered as CSS masks)
```

## Connecting the API

Pages and components never import mocks directly — they call functions in
`src/services/*`. To go live, change a service function body to call
`apiFetch()` from `src/services/api.ts` and keep its signature. See
`src/services/README.md`.

## Theming

All colors, radii, shadows and type sizes come from Figma and live in
`src/app/globals.css` (`:root` = light, `.dark` = dark). Use token classes
(`text-foreground`, `bg-surface`, `glass`, `bg-primary-fill`, …) instead of hex
values so both themes stay in sync.
