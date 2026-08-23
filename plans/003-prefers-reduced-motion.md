# 003 — Add prefers-reduced-motion support

- **Status**: DONE
- **Commit**: 63c0a17
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 3 files, medium

## Problem

There is **no `prefers-reduced-motion` handling anywhere** in the codebase (grep
returns nothing). Cards slide up on mount, icons scale, the metric counter springs,
and the connection dot pulses forever — none of it respects a user's OS-level
reduced-motion setting. AUDIT §6 / Apple §14: reduced motion means *fewer, gentler*
animations (keep opacity/color, drop movement), not zero feedback.

Movement without a reduced-motion branch exists in at least:
```tsx
/* card.tsx:16 */        initial={{ opacity: 0, y: 8 }}      // slide
/* animations.ts */      slideUp / staggerItem (y), scaleIn (scale)
/* Dashboard.tsx:38 */   useSpring counter
/* MainLayout.tsx:183 */ status dot scale pulse (infinite)
```

## Target

Two layers:

1. **CSS floor** — a global guard in `src/styles/globals.css` that neutralizes
   transform-based motion and infinite loops for the `data-state` (shadcn) and
   utility animations, keeping opacity:

```css
/* src/styles/globals.css — append */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  .animate-spin-slow { animation: none !important; }
}
```

2. **Framer branch** — respect the hook in the JS-driven animations so slides/springs
   become opacity-only. Use Framer's `useReducedMotion()`:

```tsx
/* target — src/components/ui/card.tsx */
import { motion, useReducedMotion } from "framer-motion"
// ...
const reduce = useReducedMotion()
<MotionDiv
  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.25, ease: easings.easeOut }}
/>
```

Apply the same pattern to the metric-card counter (skip the spring when `reduce` is
true — set the value directly) and the connection-dot pulse (see plan 007, which
already gates it; this plan should not double-handle it — just confirm it's covered).

## Repo conventions to follow

- Framer is already the animation layer; `useReducedMotion()` ships with
  `framer-motion` v12 — no new dependency.
- Add the CSS block at the end of `src/styles/globals.css`, after the
  `.animate-spin-slow` rule.

## Steps

1. Append the `@media (prefers-reduced-motion: reduce)` block to
   `src/styles/globals.css`.
2. `src/components/ui/card.tsx`: import `useReducedMotion`, branch the `initial`
   transform as shown.
3. `src/pages/Dashboard.tsx` (`MetricCard`, lines 34-45): when `useReducedMotion()`
   is true, render the plain number instead of the spring — e.g. skip `useSpring`'s
   animated display and show `numericValue.toLocaleString()` directly.
4. Grep `src/` for other `y:`/`x:`/`scale:` `initial`/`animate` on mount-time
   entrances (e.g. `Dashboard.tsx:75` trend row) and give each a `reduce` branch that
   drops the transform but keeps opacity.

## Boundaries

- Do NOT remove animations outright — reduced motion keeps opacity/color feedback.
- Do NOT touch `whileTap` press feedback (short, non-vestibular, fine to keep).
- Do NOT add dependencies.
- If a line doesn't match (drift since 63c0a17), STOP and report.

## Verification

- **Mechanical**: `pnpm lint && pnpm build` succeed.
- **Feel check**: in Chrome DevTools → Rendering → "Emulate CSS
  prefers-reduced-motion: reduce". Reload; navigate pages: cards fade in with **no
  vertical slide**, the connection dot does not pulse, the metric counter shows its
  final value without spinning up. Disable the emulation: motion returns.
- **Done when**: with reduced-motion emulated, no element translates/scales on
  entrance and no infinite loop runs, but opacity fades still occur.
