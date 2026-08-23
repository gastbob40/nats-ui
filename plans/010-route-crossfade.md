# 010 — Crossfade between pages on route change

- **Status**: DONE
- **Commit**: 63c0a17
- **Severity**: LOW (additive / missed opportunity)
- **Category**: Missed opportunity — spatial continuity (Apple §7)
- **Estimated scope**: 1 file, small

## Problem (opportunity)

Page changes teleport: the `<Outlet />` swaps its content instantly with no
transition, so navigating between Dashboard / Messages / Streams / etc. is an abrupt
cut. A brief crossfade smooths the state change (AUDIT §8 — content swaps that
teleport) without adding a heavy page-slide that would fight the sidebar layout.

```tsx
/* src/components/layout/MainLayout.tsx:333-335 — current */
<main className="flex-1 overflow-auto p-4">
  <Outlet />
</main>
```

Routes are defined in `src/App.tsx` with `MainLayout` as the layout route and pages
rendered through `<Outlet />`.

## Target

Wrap the outlet in `AnimatePresence` keyed by pathname, with an opacity-only
crossfade (no vertical movement — the page content already has its own entrances).
Respect reduced motion.

```tsx
/* target — src/components/layout/MainLayout.tsx */
import { Outlet, Link, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { easings } from '@/lib/animations'
// ...inside the component (useLocation() is already called as `location`):
const reduce = useReducedMotion()
// ...
<main className="flex-1 overflow-auto p-4">
  <AnimatePresence mode="wait" initial={false}>
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduce ? 0 : 0.15, ease: easings.easeOut }}
    >
      <Outlet />
    </motion.div>
  </AnimatePresence>
</main>
```

Rationale:
- `mode="wait"` — the outgoing page fades out before the incoming fades in, avoiding
  two overlapping scroll regions.
- 150ms, opacity-only — fast enough not to feel like a delay on a dashboard;
  movement is left to each page's own entrances (Apple §7: don't double up motion).
- `initial={false}` — no fade on the very first load.

## Repo conventions to follow

- `useLocation()` is already imported and called as `location` in `MainLayout.tsx`
  (used for the header title and active nav state) — reuse it for the key.
- `AnimatePresence` import pattern is established (`Messages.tsx`).
- `easings` from `@/lib/animations` (assumes plan 002; else drop `ease`).

## Steps

1. Extend the `framer-motion` import in `src/components/layout/MainLayout.tsx` to
   include `AnimatePresence`, `motion`, `useReducedMotion` (some may already be
   imported).
2. Add `const reduce = useReducedMotion()` alongside the existing hooks.
3. Wrap `<Outlet />` (MainLayout.tsx:333-335) in the keyed
   `AnimatePresence`/`motion.div` per the target.

## Boundaries

- Opacity only — do NOT add slide/scale to the route transition (pages animate their
  own content; a page-level slide would compound into motion sickness).
- Keep it ≤ 150ms — a slow page transition on a dashboard reads as lag.
- Do NOT change routing logic in `App.tsx`.
- Do NOT add dependencies.
- If a line doesn't match (drift since 63c0a17), STOP and report.

## Verification

- **Mechanical**: `pnpm lint && pnpm build` succeed.
- **Feel check**: run `pnpm dev`; click between sidebar items. Pages **crossfade**
  instead of hard-cutting; there is no perceptible delay. Rapidly clicking several
  nav items does not stack or flicker — `mode="wait"` serializes them. DevTools →
  Rendering → reduced motion: transition is instant (no fade), no jump.
- **Done when**: navigation crossfades in ~150ms and is instant under reduced motion.
