# 007 — Connection dot: opacity pulse, gated by reduced-motion

- **Status**: DONE
- **Commit**: 63c0a17
- **Severity**: LOW
- **Category**: Purpose & frequency / Accessibility
- **Estimated scope**: 1 file, tiny

## Problem

The "connected" status dot pulses forever by **scaling** — a perpetual,
transform-based loop that draws the eye and is not gated by reduced motion. A
status indicator should read as "alive" without moving/resizing; a gentle opacity
breathe is calmer and non-vestibular.

```tsx
/* src/components/layout/MainLayout.tsx:181-191 — current */
<motion.div
  className={`h-2 w-2 rounded-full ${getStatusColor(status)}`}
  animate={status === 'connected' ? {
    scale: [1, 1.1, 1],
    transition: { duration: 2, repeat: Infinity, ease: [0.4, 0.0, 0.2, 1] }
  } : {}}
/>
```

(The same `scale` pulse pattern also lives in `animations.ts:176` `pulse` — leave
that export; this plan only fixes the connection dot's usage.)

## Target

Breathe opacity instead of scale, and stop the loop entirely under reduced motion.

```tsx
/* target */
const reduce = useReducedMotion()
<motion.div
  className={`h-2 w-2 rounded-full ${getStatusColor(status)}`}
  animate={status === 'connected' && !reduce
    ? { opacity: [1, 0.4, 1] }
    : { opacity: 1 }}
  transition={status === 'connected' && !reduce
    ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
    : { duration: 0 }}
/>
```

Rationale: `opacity` is compositor-friendly and non-vestibular; a 2s cycle
(0.5 Hz) avoids the slow-oscillation range Apple §14 warns about; `!reduce` stops it
for reduced-motion users while the dot stays fully visible.

## Repo conventions to follow

- `useReducedMotion()` from `framer-motion` (see plan 003) — reuse it if this file
  already imports it after 003; otherwise add the import.
- Keep the color-by-status logic (`getStatusColor(status)`) untouched.

## Steps

1. In `src/components/layout/MainLayout.tsx`, ensure `useReducedMotion` is imported
   from `framer-motion`.
2. Replace the connection-dot `motion.div` (MainLayout.tsx:181-191) with the target:
   opacity keyframes, `transition` split out, gated by `!reduce`.

## Boundaries

- Do NOT change the dot's size/color classes.
- Do NOT modify the shared `pulse` export in `animations.ts`.
- Do NOT add dependencies.
- If a line doesn't match (drift since 63c0a17), STOP and report.

## Verification

- **Mechanical**: `pnpm lint && pnpm build` succeed.
- **Feel check**: run `pnpm dev` connected to NATS. The dot **breathes in opacity**,
  does not change size. In DevTools → Rendering → emulate
  `prefers-reduced-motion: reduce`: the dot is steady at full opacity, no loop.
- **Done when**: the connected dot pulses via opacity only and halts under reduced
  motion.
