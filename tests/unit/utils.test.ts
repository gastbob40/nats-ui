import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('merges conflicting tailwind classes, last one wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('handles conditional and nested inputs', () => {
    const isHidden = false;
    expect(cn('a', isHidden && 'b', undefined, ['c', { d: true, e: false }])).toBe('a c d');
  });

  it('returns an empty string without inputs', () => {
    expect(cn()).toBe('');
  });
});
