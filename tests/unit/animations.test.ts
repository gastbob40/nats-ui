import { describe, expect, it } from 'vitest';
import * as animations from '@/lib/animations';

// The module is pure data (variants + transitions); this pins the conventions
// the motion system relies on.
describe('animation variants', () => {
  it('defines the four standard easing curves as 4-point beziers', () => {
    for (const curve of Object.values(animations.easings)) {
      expect(curve).toHaveLength(4);
    }
  });

  it('exposes hidden/visible states on the entrance variants', () => {
    for (const variants of [animations.fadeIn, animations.slideUp, animations.scaleIn]) {
      expect(variants).toHaveProperty('hidden');
      expect(variants).toHaveProperty('visible');
    }
  });

  it('builds count-up props from the target value', () => {
    expect(animations.useCountUp(42, 2)).toEqual({
      initial: 0,
      animate: 42,
      transition: { duration: 2, ease: 'easeOut' },
    });
    expect(animations.useCountUp(7).transition.duration).toBe(1);
  });
});
