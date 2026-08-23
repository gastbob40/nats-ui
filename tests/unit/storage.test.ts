import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadJSON, saveJSON } from '@/lib/storage';

describe('storage helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the fallback when the key is missing', () => {
    expect(loadJSON('missing', { a: 1 })).toEqual({ a: 1 });
  });

  it('round-trips a value through saveJSON/loadJSON', () => {
    saveJSON('key', { topics: ['a', 'b'], count: 2 });
    expect(loadJSON('key', null)).toEqual({ topics: ['a', 'b'], count: 2 });
  });

  it('falls back on corrupt JSON without throwing', () => {
    localStorage.setItem('key', '{not json');
    expect(loadJSON('key', 'fallback')).toBe('fallback');
    expect(console.error).toHaveBeenCalled();
  });

  it('falls back when localStorage.getItem throws', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(loadJSON('key', 42)).toBe(42);
  });

  it('swallows quota errors from localStorage.setItem', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(() => saveJSON('key', 'value')).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });

  it('swallows serialization errors for unserializable values', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => saveJSON('key', circular)).not.toThrow();
    expect(console.error).toHaveBeenCalled();
  });
});
