# 004 — Retune default springs to critically damped (Apple)

- **Status**: DONE
- **Commit**: 63c0a17
- **Severity**: MEDIUM
- **Category**: Physicality & origin (Apple §4)
- **Estimated scope**: 1 file, small

## Problem

The shared springs are under-damped, so non-momentum UI overshoots and bounces
slightly where it shouldn't. Apple's *Designing Fluid Interfaces* rule: default UI to
**critically damped (damping ratio 1.0, no overshoot)**; add bounce *only* when the
gesture itself carried momentum (a flick/throw/drag release). Hover and layout
toggles carry no momentum.

```ts
/* src/lib/animations.ts:201-216 — current */
export const iconSpring: Transition = {
  type: 'spring', stiffness: 400, damping: 25, mass: 0.5,   // ratio ≈ 0.88 → bounces
};
export const standardSpring: Transition = {
  type: 'spring', stiffness: 300, damping: 30, mass: 1,     // ratio ≈ 0.87 → bounces
};
```

Damping ratio = `damping / (2·√(stiffness·mass))`. Both land ~0.87–0.88 (visible
overshoot). These springs drive hover icons and layout — no momentum, so no bounce.

## Target

Use Framer v12's designer-friendly spring API (`bounce` + `duration`), which maps
directly to Apple's damping + response. `bounce: 0` == critically damped.

```ts
/* target — src/lib/animations.ts */
export const iconSpring: Transition = {
  type: 'spring',
  bounce: 0,        // critically damped — no overshoot (Apple default)
  duration: 0.3,    // response ~0.3s, snappy for small elements
};

export const standardSpring: Transition = {
  type: 'spring',
  bounce: 0,
  duration: 0.4,    // response ~0.4s for medium elements
};
```

If a genuinely momentum-driven interaction is added later (drag-to-dismiss, flick),
that specific spring — and only it — may use `bounce: 0.2` (Apple §4). Do not add a
bouncy spring anywhere in this plan.

## Repo conventions to follow

- All springs are centralized in `src/lib/animations.ts` and imported by
  `button.tsx`, `MainLayout.tsx`, `Dashboard.tsx` — editing the two exports here
  propagates everywhere. Do not inline new spring configs in components.

## Steps

1. Replace `iconSpring` and `standardSpring` in `src/lib/animations.ts:201-216` with
   the target `bounce`/`duration` form above.
2. Grep `src/` for any inline `type: 'spring'` with `stiffness`/`damping` and, if
   found, either route it through `iconSpring`/`standardSpring` or convert it to
   `bounce: 0` form. (`Dashboard.tsx:38` `useSpring({ stiffness: 100, damping: 30 })`
   is a *value* spring for the counter — leave it; a slow settle is fine for a
   number ticking up, and it is not an overshoot-on-UI case.)

## Boundaries

- Do NOT introduce visible bounce anywhere — there is no momentum interaction yet.
- Do NOT change the `useSpring` counter in `Dashboard.tsx` (out of scope).
- Do NOT add dependencies.
- If Framer rejects `bounce`/`duration` on `Transition` typing, STOP and report
  (would indicate a version mismatch vs the assumed v12).

## Verification

- **Mechanical**: `pnpm lint && pnpm build` succeed.
- **Feel check**: run `pnpm dev`; toggle the sidebar (rail chevron) and hover the
  logo. In DevTools Animations panel at 10% speed, confirm the motion **settles
  without overshooting/bouncing past its target**.
- **Done when**: `iconSpring` and `standardSpring` use `bounce: 0`, and no spring in
  the app overshoots on a non-gesture interaction.
