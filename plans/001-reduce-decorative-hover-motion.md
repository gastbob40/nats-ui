# 001 — Remove decorative hover motion from buttons and icons

- **Status**: DONE
- **Commit**: 63c0a17
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 3 files, small

## Problem

The most frequently-hit elements in the app grow and rotate on hover. In a crisp
operational dashboard this reads as noise, and `scale`/`rotate` on hover are
decorative motion on targets hit tens of times per session (AUDIT §1: "Remove or
drastically reduce"). The `whileTap` press feedback is correct and must stay
(Apple §1 — respond on press).

```tsx
/* src/components/ui/button.tsx:40 — current (every button in the app) */
whileHover={{ scale: 1.02 }}
whileTap={{ scale: 0.97 }}
```

```tsx
/* src/components/layout/MainLayout.tsx:173 — logo */
whileHover={{ scale: 1.05, rotate: 3 }}
/* MainLayout.tsx:221 — nav item icon (high frequency) */
variants={{ hover: { scale: 1.1, rotate: 3 } }}
/* MainLayout.tsx:254 — GitHub icon */
whileHover={{ scale: 1.1, rotate: 3 }}
```

```tsx
/* src/pages/Dashboard.tsx:59 — metric card icon */
whileHover={{ scale: 1.15, rotate: 5 }}
```

## Target

- **Button**: drop `whileHover` entirely. Keep `whileTap={{ scale: 0.97 }}`.
- **Nav item icon** (`MainLayout.tsx:217-227`): remove the `rotate` and reduce
  scale. Rotation on a high-frequency nav target is the worst offender — delete it.
  Keep at most an opacity/color affordance (already provided by the sidebar's
  `hover:bg-accent`), so the inner `motion.div` variant can be removed and the icon
  rendered plainly.
- **Logo / GitHub icons**: remove `rotate`; a subtle `scale: 1.05` on hover is
  acceptable on these low-frequency, non-nav targets, but drop rotation.
- **Metric card icon** (`Dashboard.tsx:58-63`): remove `rotate`; keep no hover or a
  quiet `scale: 1.05` at most.

## Repo conventions to follow

- Motion lives inline as Framer `motion.*` props; there is no CSS hover-scale
  convention. Removing props is the idiomatic fix here.
- The sidebar already provides hover feedback via `hover:bg-accent` classes
  (`sidebar.tsx`), so nav icons need no motion of their own.

## Steps

1. `src/components/ui/button.tsx`: delete the `whileHover={{ scale: 1.02 }}` line
   (button.tsx:40). Leave `whileTap` and `transition` untouched.
2. `src/components/layout/MainLayout.tsx:217-230`: remove the `whileHover="hover"`
   on the outer wrapper and the inner `motion.div` with the `hover` variant; render
   `<Icon className="h-4 w-4" />` directly inside the `Link`.
3. `MainLayout.tsx:173`: change to `whileHover={{ scale: 1.05 }}` (drop `rotate: 3`).
4. `MainLayout.tsx:254`: change to `whileHover={{ scale: 1.1 }}` (drop `rotate: 3`).
5. `src/pages/Dashboard.tsx:59`: change to `whileHover={{ scale: 1.05 }}` (drop
   `rotate: 5`), or remove the wrapper's hover entirely.

## Boundaries

- Do NOT touch `whileTap` anywhere — press feedback stays.
- Do NOT change layout/markup beyond removing the now-empty motion wrappers.
- Do NOT add dependencies.
- If a line doesn't match (drift since 63c0a17), STOP and report.

## Verification

- **Mechanical**: `pnpm lint && pnpm build` succeed.
- **Feel check**: run `pnpm dev`; hover buttons and nav items — no growing/rotating.
  Press a button — it still dips to 0.97 (press feedback intact). Sidebar nav still
  shows its background hover state.
- **Done when**: no `rotate` remains in any `whileHover`, and no button grows on
  hover, while `whileTap` press feedback is unchanged.
