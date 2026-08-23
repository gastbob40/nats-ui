import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useNats } from '@/hooks/useNats';
import { NatsContext, type NatsContextType } from '@/contexts/nats-context';

describe('useNats', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws when used outside a NatsProvider', () => {
    // React logs the throw before the hook surfaces it; keep the output clean.
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useNats())).toThrow('useNats must be used within a NatsProvider');
  });

  it('returns the context value inside a provider', () => {
    const value = { status: 'connected', isConnected: true } as NatsContextType;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NatsContext.Provider value={value}>{children}</NatsContext.Provider>
    );

    const { result } = renderHook(() => useNats(), { wrapper });
    expect(result.current).toBe(value);
  });
});
