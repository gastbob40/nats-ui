# 005 — Make the Card mount animation opt-in

- **Status**: DONE
- **Commit**: 63c0a17
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file (+ optional call-site sweep), small

## Problem

The mount fade+slide-up is baked into the `Card` primitive itself, so *every* card
animates on *every* mount — on each page navigation, and whenever a card is
conditionally re-rendered or appears in a list. A base UI atom should not carry a
mandatory entrance; it makes nested cards double-animate and can't be opted out of.

```tsx
/* src/components/ui/card.tsx:6-24 — current */
function Card({ className, ...props }: React.ComponentProps<"div">) {
  const MotionDiv = motion.div
  return (
    <MotionDiv
      data-slot="card"
      className={cn("bg-card ...", className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.0, 0.0, 0.2, 1] }}
      {...(props as ...)}
    />
  )
}
```

## Target

`Card` renders a plain `div` by default; the entrance is opt-in via an `animateIn`
prop. This keeps the atom quiet and lets pages (e.g. Dashboard's metric grid) opt in
with a stagger where it actually reads as intentional.

```tsx
/* target — src/components/ui/card.tsx */
import { motion, useReducedMotion } from "framer-motion"
import { easings } from "@/lib/animations"

type CardProps = React.ComponentProps<"div"> & { animateIn?: boolean }

function Card({ className, animateIn = false, ...props }: CardProps) {
  const reduce = useReducedMotion()
  const classes = cn(
    "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
    className,
  )
  if (!animateIn) {
    return <div data-slot="card" className={classes} {...props} />
  }
  return (
    <motion.div
      data-slot="card"
      className={classes}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: easings.easeOut }}
      {...(props as React.ComponentProps<typeof motion.div>)}
    />
  )
}
```

Note: `easings.easeOut` assumes plan 002 landed (strong curve). If 002 has not run,
use `[0.0, 0.0, 0.2, 1]` inline as today and let 002 replace it.

## Repo conventions to follow

- Other UI atoms in `src/components/ui/` are plain elements accepting `className`;
  `Card` should match that baseline and treat motion as an explicit choice.
- The Dashboard metric grid already wraps cards in `staggerContainer`/`staggerItem`
  (`Dashboard.tsx:48-54`), so the per-card `initial/animate` is redundant there —
  the stagger parent handles entrance. This is the strongest reason to remove it
  from the atom.

## Steps

1. Rewrite `Card` in `src/components/ui/card.tsx` per the target (add `animateIn`
   prop, default plain `div`).
2. Leave `CardHeader`/`CardContent`/etc. unchanged.
3. Optional call-site sweep: grep `<Card` across `src/pages`. Where a page shows a
   single hero card that benefits from an entrance and is NOT already inside a
   stagger container, add `animateIn`. Do **not** add `animateIn` to cards already
   inside `staggerContainer` (Dashboard metric grid) — the parent animates them.

## Boundaries

- Do NOT change the card's visual classes (padding, radius, shadow).
- Do NOT add `animateIn` to list/grid cards already covered by a stagger parent.
- Do NOT add dependencies.
- If a line doesn't match (drift since 63c0a17), STOP and report.

## Verification

- **Mechanical**: `pnpm lint && pnpm build` succeed.
- **Feel check**: run `pnpm dev`; navigate to a data-heavy page (Streams, KV) — cards
  appear **instantly, no slide** unless a page opted in. Dashboard metric cards still
  stagger in (via their parent), and do not double-animate (watch at 10% speed for a
  single clean entrance, not a slide-within-a-slide).
- **Done when**: `Card` with no props renders a static div, and no card inside a
  stagger container carries its own entrance.
