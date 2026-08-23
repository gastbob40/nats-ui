import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Testing Library only auto-registers its cleanup when the test runner
// exposes a global afterEach, which vitest does not without globals: true.
afterEach(() => cleanup());

// Node 22+ ships an experimental `localStorage` global that stays undefined
// unless --localstorage-file is passed, and it shadows happy-dom's storage on
// the test global scope (window.sessionStorage survives, window.localStorage
// does not). Happy-dom's Storage cannot be constructed from user code, so
// back the global with a minimal in-memory implementation of the same API.
class MemoryStorage {
  #items = new Map<string, string>();

  get length(): number {
    return this.#items.size;
  }

  clear(): void {
    this.#items.clear();
  }

  getItem(key: string): string | null {
    return this.#items.get(String(key)) ?? null;
  }

  key(index: number): string | null {
    return [...this.#items.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#items.delete(String(key));
  }

  setItem(key: string, value: string): void {
    this.#items.set(String(key), String(value));
  }
}

for (const scope of [globalThis, window] as unknown as Record<string, unknown>[]) {
  Object.defineProperty(scope, 'localStorage', {
    value: new MemoryStorage() as unknown as Storage,
    configurable: true,
    writable: true,
  });
}
