/**
 * Motion tokens & shared variants.
 *
 * Grounded in the "Animations on the Web" (animations.dev) bar:
 * - strong asymmetric ease-out curves (built-in curves are too weak)
 * - never ease-in on UI; exits are shorter and simpler than entries
 * - springs default to bounce 0 (no overshoot)
 * - UI motion stays under ~300ms
 *
 * CSS-side tokens (--ease-out-expo, --ease-out-quad, --ease-in-out-cubic,
 * .status-pulse) live in src/styles/globals.css.
 */

import { type Variants, type Transition } from 'motion/react';

/** Easing curves — steep start, gentle settle. */
export const easings = {
  /** Entrances, exits, reveals (strong ease-out — expo). */
  easeOut: [0.19, 1, 0.22, 1],
  /** Moves/rotations while on screen (accelerate then brake). */
  easeInOut: [0.645, 0.045, 0.355, 1],
  /** Height/size changes (snappy settle). */
  easeOutHeight: [0.25, 1, 0.5, 1],
} as const;

/** Page content entrance on route change — one entrance per container. */
export const pageEnter: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: easings.easeOut },
  },
};

/**
 * Live-feed list item (new messages arrive at the top, many per minute):
 * quiet fade from above, fade-only exit — faster than the entry.
 */
export const listItem: Variants = {
  hidden: { opacity: 0, y: -8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: easings.easeOut },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: easings.easeOut },
  },
};

/** State/icon swaps — critically damped spring, no overshoot. */
export const swapSpring: Transition = { type: 'spring', duration: 0.3, bounce: 0 };
