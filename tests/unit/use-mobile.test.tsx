import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsMobile } from '@/hooks/use-mobile';

type Listener = () => void;

function stubMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<Listener>();
  const mql = {
    get matches() {
      return matches;
    },
    media: '(max-width: 767px)',
    addEventListener: (_event: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_event: string, listener: Listener) => listeners.delete(listener),
  };
  vi.stubGlobal('matchMedia', vi.fn(() => mql));

  return {
    listeners,
    resize(nowMatches: boolean) {
      matches = nowMatches;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('useIsMobile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reflects the initial media query state', () => {
    stubMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it('tracks viewport changes', () => {
    const media = stubMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => media.resize(true));
    expect(result.current).toBe(true);

    act(() => media.resize(false));
    expect(result.current).toBe(false);
  });

  it('removes its listener on unmount', () => {
    const media = stubMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());
    expect(media.listeners.size).toBe(1);

    unmount();
    expect(media.listeners.size).toBe(0);
  });
});
