# 006 — Fix theme-toggle icon exit (dead AnimatePresence)

- **Status**: DONE
- **Commit**: 63c0a17
- **Severity**: LOW
- **Category**: Interruptibility
- **Estimated scope**: 1 file, tiny

## Problem

The theme-cycle button animates its icon with an `exit` variant, but the
`motion.div` is not wrapped in an `AnimatePresence`, so the `exit` animation
**never runs** — the old icon is unmounted instantly and only the incoming icon's
`initial`→`animate` plays. The `exit` prop is dead code and the swap looks
one-sided (spin-in with no spin-out).

```tsx
/* src/components/layout/MainLayout.tsx:268-276 — current */
<motion.div
  key={theme}
  initial={{ rotate: -180, opacity: 0 }}
  animate={{ rotate: 0, opacity: 1 }}
  exit={{ rotate: 180, opacity: 0 }}
  transition={{ duration: 0.3 }}
>
  {getThemeIcon()}
</motion.div>
```

## Target

Wrap the keyed `motion.div` in `AnimatePresence mode="wait"` so the outgoing icon
spins out before the incoming spins in — a clean, symmetric swap. Also route the
duration through the shared curve for consistency.

```tsx
/* target */
<AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={theme}
    initial={{ rotate: -180, opacity: 0 }}
    animate={{ rotate: 0, opacity: 1 }}
    exit={{ rotate: 180, opacity: 0 }}
    transition={{ duration: 0.3, ease: easings.easeOut }}
  >
    {getThemeIcon()}
  </motion.div>
</AnimatePresence>
```

`initial={false}` on `AnimatePresence` prevents a spin on first paint (the icon
should only animate on *change*, not on initial load).

## Repo conventions to follow

- `AnimatePresence` is already used in the app (`Messages.tsx:1086`), so the import
  pattern (`import { AnimatePresence } from "framer-motion"`) is established.
- `easings` comes from `@/lib/animations` (already imported in this file as
  `iconSpring`; extend the import).

## Steps

1. In `src/components/layout/MainLayout.tsx`, add `AnimatePresence` (and `easings` if
   not already imported) to the `framer-motion` / `@/lib/animations` imports.
2. Wrap the theme-icon `motion.div` (MainLayout.tsx:268-276) in
   `<AnimatePresence mode="wait" initial={false}>…</AnimatePresence>`.
3. Add `ease: easings.easeOut` to its `transition` (depends on plan 002 for the
   strong curve; if 002 hasn't run, omit `ease` and leave the default).

## Boundaries

- Do NOT change the icon rendering (`getThemeIcon()`) or the button behavior.
- Do NOT add dependencies.
- If a line doesn't match (drift since 63c0a17), STOP and report.

## Verification

- **Mechanical**: `pnpm lint && pnpm build` succeed.
- **Feel check**: run `pnpm dev`; click the theme button repeatedly. The old icon
  now **spins out** (rotate 180 + fade) as the new one spins in — a symmetric swap,
  not an abrupt replace. On first page load the icon does **not** spin (thanks to
  `initial={false}`). Spamming the button doesn't stack icons.
- **Done when**: the exit animation is visibly playing on each theme change.
