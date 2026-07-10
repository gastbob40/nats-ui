/**
 * Small typed helpers around localStorage.
 *
 * Every access is wrapped in try/catch so that private-browsing modes,
 * quota errors, or corrupt JSON never crash the app — they fall back
 * gracefully to the provided default.
 */

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Failed to load "${key}" from localStorage:`, error);
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save "${key}" to localStorage:`, error);
  }
}
