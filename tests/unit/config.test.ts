import { afterEach, describe, expect, it, vi } from 'vitest';

// The config module derives the NATS endpoints from window.location at import
// time, so each case stubs the window and re-imports a fresh copy.
async function loadConfig(windowValue: unknown) {
  vi.resetModules();
  vi.stubGlobal('window', windowValue);
  const { config } = await import('@/config');
  return config;
}

describe('config endpoint derivation', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('derives ws/http endpoints from the page host over http', async () => {
    const config = await loadConfig({ location: { protocol: 'http:', hostname: 'nats-box' } });

    expect(config.nats.wsUrl).toBe('ws://nats-box:9222');
    expect(config.nats.httpUrl).toBe('http://nats-box:8222');
  });

  it('mirrors the page scheme for TLS deployments', async () => {
    const config = await loadConfig({ location: { protocol: 'https:', hostname: 'nats.example.com' } });

    expect(config.nats.wsUrl).toBe('wss://nats.example.com:9222');
    expect(config.nats.httpUrl).toBe('https://nats.example.com:8222');
  });

  it('falls back to localhost without a window (SSR/tests)', async () => {
    const config = await loadConfig(undefined);

    expect(config.nats.wsUrl).toBe('ws://localhost:9222');
    expect(config.nats.httpUrl).toBe('http://localhost:8222');
  });

  it('exposes the app defaults', async () => {
    const config = await loadConfig(undefined);

    expect(config.app.maxMessages).toBe(1000);
    expect(config.nats.connectionTimeout).toBeGreaterThan(0);
    expect(config.app.monitoringRefreshInterval).toBeGreaterThan(0);
  });
});
