# 008 — Prefer compositor transforms over Framer shorthands (perf)

- **Status**: DEFERRED (profile first)
- **Commit**: 63c0a17
- **Severity**: LOW
- **Category**: Performance
- **Estimated scope**: audit + targeted edits, medium — **profile first**

## Problem

Framer Motion's `x`/`y`/`scale`/`rotate` shorthands are not always promoted to the
compositor the way a raw `transform` string is; under load they can run on the main
thread and drop frames (AUDIT §5, Apple §11). This app has live-polling surfaces
(Dashboard metrics, Messages stream) where main-thread contention is plausible, and
Framer shorthands are used pervasively (`button.tsx`, `card.tsx`, `Dashboard.tsx`,
`MainLayout.tsx`, `sidebar.tsx`).

This is the **lowest-priority** finding and is easy to over-fix. Do NOT bulk-rewrite
every `scale`/`y` — most are one-shot entrances that never coincide with load and are
fine. Only act where profiling shows dropped frames.

## Target

1. **Profile before changing anything.** With the app connected and messages flowing
   (Messages page) or metrics polling (Dashboard), record a DevTools Performance
   trace while hovering/scrolling. Identify any animation that drops below 60fps.
2. For any confirmed janky animation, convert the Framer shorthand to an explicit
   transform and add `will-change` only where motion is imminent:

```tsx
/* example only — apply where profiling shows jank */
animate={{ transform: "translateY(0px)" }}   // instead of { y: 0 }
style={{ willChange: "transform" }}
```

3. Ensure no animated element uses layout properties (`width`/`height`/`top`/`left`/
   `margin`/`padding`) — grep confirms none currently animate these, keep it that way.

## Repo conventions to follow

- Springs/curves stay centralized in `src/lib/animations.ts`.
- Prefer removing an unnecessary animation over optimizing it (see plans 001, 005 —
  many shorthands disappear once decorative hover and the baked card entrance are
  gone, which may resolve this finding without further work).

## Steps

1. Land plans 001 and 005 first — they delete a large share of the shorthand usage.
2. Re-profile. If no animation drops frames, mark this plan **DONE (no change
   needed)** and record that in the completion report.
3. Only if jank remains: convert the specific offending shorthands to `transform`
   strings and add scoped `will-change`. List each site changed.

## Boundaries

- Do NOT bulk-convert shorthands with no measured jank — it hurts readability for no
  gain and `will-change` everywhere is itself a perf regression.
- Do NOT animate layout properties.
- Do NOT add dependencies.

## Verification

- **Mechanical**: `pnpm lint && pnpm build` succeed.
- **Feel check**: DevTools Performance trace on Messages (live stream) and Dashboard
  (polling) shows the target animation holding ~60fps where it previously dropped.
- **Done when**: either profiling shows no jank (plan closed as no-change-needed) or
  each measured drop is fixed and re-profiled green.
