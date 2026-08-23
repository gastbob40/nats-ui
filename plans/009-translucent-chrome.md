# 009 — Translucent chrome for header and sidebar (Apple materials)

- **Status**: DONE
- **Commit**: 63c0a17
- **Severity**: LOW (additive / missed opportunity)
- **Category**: Missed opportunity — materials & depth (Apple §12)
- **Estimated scope**: 2 files, small

## Problem (opportunity)

The top header and the sidebar are opaque bars with a hard 1px border divider:

```tsx
/* src/components/layout/MainLayout.tsx:285 — header */
<header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
/* MainLayout.tsx:284 — inset content region */
<SidebarInset className="flex flex-1 flex-col overflow-hidden">
/* main scroll region — MainLayout.tsx:333 */
<main className="flex-1 overflow-auto p-4">
```

Apple §12: build nav/toolbars as **translucent floating layers** (`backdrop-filter`
blur + semi-transparent background) with content scrolling underneath, instead of
opaque strips separated by hard dividers. This adds depth and signals "floating
chrome" without stealing focus. This is additive polish, not a correctness fix.

## Target

Make the header a translucent material with a subtle scroll-edge treatment, and gate
it behind `prefers-reduced-transparency` (Apple §14). Use existing theme tokens so it
adapts to light/dark.

```css
/* src/styles/globals.css — append */
@utility chrome-translucent {
  background: color-mix(in oklch, var(--background) 72%, transparent);
  backdrop-filter: blur(12px) saturate(160%);
  -webkit-backdrop-filter: blur(12px) saturate(160%);
}
@media (prefers-reduced-transparency: reduce) {
  .chrome-translucent {
    background: var(--background);
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
```

Then, in `MainLayout.tsx`, make the header sticky + translucent so content scrolls
under it:

```tsx
/* target — header */
<header className="chrome-translucent sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 px-4">
```

Notes:
- Keep a *faint* border (`border-border/60`) rather than a hard divider — Apple §12
  prefers a soft edge where floating chrome meets content.
- `main` already scrolls (`overflow-auto`), so a sticky translucent header will show
  content blurring underneath as expected.
- Do NOT stack a second translucent surface on top of this one (Apple §12: never
  stack light translucent surfaces — legibility collapses). The sidebar can stay as
  is, or receive the same treatment, but not a translucent element *inside* the
  translucent header.

## Repo conventions to follow

- Theme colors are oklch tokens in `src/styles/globals.css` (`--background`,
  `--border`, …) with a `.dark` override — use `color-mix(... var(--background) ...)`
  so it adapts automatically to both themes.
- Tailwind v4 `@utility` is the project's mechanism for custom classes (this repo
  uses Tailwind v4 with `@import "tailwindcss"`).

## Steps

1. Append the `@utility chrome-translucent` and the
   `prefers-reduced-transparency` block to `src/styles/globals.css`.
2. Edit the `<header>` in `src/components/layout/MainLayout.tsx:285` to add
   `chrome-translucent sticky top-0 z-10` and soften the border to
   `border-border/60`.
3. Visually verify the sidebar does not double-stack translucency; if desired, apply
   `chrome-translucent` to the sidebar container too — but only one layer deep.

## Boundaries

- Do NOT apply translucency to two nested surfaces (legibility).
- Do NOT change header height, layout, or the status badges inside it.
- Keep `backdrop-filter` blur ≤ 20px (AUDIT §5 — heavy blur is expensive in Safari);
  12px is chosen deliberately.
- Do NOT add dependencies.
- If a line doesn't match (drift since 63c0a17), STOP and report.

## Verification

- **Mechanical**: `pnpm lint && pnpm build` succeed.
- **Feel check**: run `pnpm dev` on a page with enough content to scroll (Messages,
  KV). Scroll the main area — content is **visible, blurred, under the header**, not
  hidden behind an opaque bar. Toggle light/dark: the material adapts. DevTools →
  Rendering → emulate `prefers-reduced-transparency: reduce`: header becomes solid.
- **Done when**: the header reads as a floating translucent layer in both themes and
  falls back to solid under reduced-transparency.
