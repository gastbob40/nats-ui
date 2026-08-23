# 002 — Consolidate easing to strong tokens and fix ease-in exits

- **Status**: DONE
- **Commit**: 63c0a17
- **Severity**: HIGH
- **Category**: Easing & duration / Cohesion & tokens
- **Estimated scope**: 5 files, medium

## Problem

Easing is defined with weak Material-Design curves, hand-duplicated inline in
multiple components, and **`ease-in` is applied to every exit** — which starts the
exit slowly, delaying the moment the user is watching. AUDIT §2: entering *and*
exiting should use `ease-out`; built-in/weak curves are too soft for deliberate
motion.

```ts
/* src/lib/animations.ts:21-30 — current */
export const easings = {
  easeOut: [0.0, 0.0, 0.2, 1] as const,   // weak
  easeIn:  [0.4, 0.0, 1, 1] as const,      // used on EXITS — wrong
  standard:[0.4, 0.0, 0.2, 1] as const,
  sharp:   [0.4, 0.0, 0.6, 1] as const,
};
```

The same weak curve is hand-typed inline in:
```tsx
/* button.tsx:44 */  ease: [0.4, 0.0, 0.2, 1]
/* card.tsx:20 */    ease: [0.0, 0.0, 0.2, 1]
/* sidebar.tsx:283 */ ease: [0.0, 0.0, 0.2, 1]
/* MainLayout.tsx:188 */ ease: [0.4, 0.0, 0.2, 1]
```

`easeIn` is consumed by the `exit` blocks of `fadeIn` (animations.ts:47),
`slideUp` (:71), and `scaleIn` (:133).

## Target

Strong curves as the single source of truth (AUDIT §2). Framer takes cubic-bezier
control points as a 4-tuple, matching the CSS token values exactly:

```ts
/* target — src/lib/animations.ts */
export const easings = {
  // strong ease-out for UI enter/exit (cubic-bezier(0.23, 1, 0.32, 1))
  easeOut: [0.23, 1, 0.32, 1] as const,
  // strong ease-in-out for on-screen movement (cubic-bezier(0.77, 0, 0.175, 1))
  standard: [0.77, 0, 0.175, 1] as const,
  // iOS-like drawer curve (cubic-bezier(0.32, 0.72, 0, 1))
  drawer: [0.32, 0.72, 0, 1] as const,
} as const;
```

- Every `exit` in `fadeIn`/`slideUp`/`scaleIn` uses `easings.easeOut` (not `easeIn`).
- `quickTransition` (animations.ts:229) currently uses `easings.sharp` — point it at
  `easings.easeOut`.
- Remove `easeIn` and `sharp` (no longer referenced after the above).
- Replace the four inline hand-typed arrays with `easings.easeOut` imported from
  `@/lib/animations`.

Also define matching CSS tokens for the Tailwind/`data-state` layer, in
`src/styles/globals.css` inside `:root` (Apple §7 — mirror curves on reversible
transitions; these back the shadcn `animate-in/out` primitives if durations are ever
customized):

```css
/* src/styles/globals.css :root */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

## Repo conventions to follow

- All Framer easing already flows through `easings` in `src/lib/animations.ts` —
  keep that as the single source; components import from `@/lib/animations`.
- CSS custom properties live in `:root` / `.dark` in `src/styles/globals.css`
  (see `--radius`, `--ring`, etc.).

## Steps

1. Edit `src/lib/animations.ts:21-30` to the target `easings` object (three curves).
2. In the same file, update `fadeIn.exit`, `slideUp.exit`, `scaleIn.exit` to
   `ease: easings.easeOut`. Update `quickTransition` and `smoothTransition` to use
   `easings.easeOut` / `easings.standard` respectively (they already reference the
   object — just ensure no `sharp`/`easeIn` references remain).
3. Grep for `easings.easeIn` and `easings.sharp` across `src/`; replace any
   remaining consumers with `easings.easeOut`.
4. Replace inline arrays with the token:
   - `button.tsx:42-45` → `transition={{ duration: 0.15, ease: easings.easeOut }}`
     (add `import { easings } from "@/lib/animations"`).
   - `card.tsx:18-21` → `ease: easings.easeOut`.
   - `sidebar.tsx:281-284` → `ease: easings.easeOut`.
   - `MainLayout.tsx:185-189` → `ease: easings.easeOut`.
5. Add the three CSS tokens to `:root` in `src/styles/globals.css`.

## Boundaries

- Do NOT change durations in this plan (that's out of scope; they're within budget).
- Do NOT alter markup or add dependencies.
- If `easeIn`/`sharp` are referenced somewhere not listed, replace with `easeOut`
  and note it in the completion report; do not invent new curves.
- If a line doesn't match (drift since 63c0a17), STOP and report.

## Verification

- **Mechanical**: `pnpm lint && pnpm build` — no TypeScript errors from removed
  `easings` keys (means all consumers were updated).
- **Feel check**: run `pnpm dev`; open/close a dialog and a dropdown, navigate
  between pages. Exits should feel *snappy from the first frame*, not sluggish.
  In DevTools Animations panel at 10% speed, confirm exits decelerate (ease-out
  shape), not accelerate.
- **Done when**: no `easeIn`/`sharp` remain, no inline cubic-bezier arrays remain in
  the four components, and the three CSS tokens exist in `:root`.
