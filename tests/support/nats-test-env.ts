/**
 * Shared bootstrap for the test suites that need real NATS servers.
 *
 * If the three test servers already answer on their monitoring ports (because
 * `pnpm test:env` is running, or a previous suite left them up), they are
 * reused as-is. Otherwise the compose file is started, and the returned
 * teardown stops it — we only ever stop what we started.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const COMPOSE_FILE = fileURLToPath(new URL('../../docker/docker-compose.test.yml', import.meta.url));

export const NATS_TEST_SERVERS = {
  main: { ws: 'ws://localhost:9222', client: 'nats://localhost:4222', monitor: 'http://localhost:8222' },
  authUser: { ws: 'ws://localhost:9223', client: 'nats://localhost:4223', monitor: 'http://localhost:8223' },
  authToken: { ws: 'ws://localhost:9224', client: 'nats://localhost:4224', monitor: 'http://localhost:8224' },
} as const;

export const NATS_TEST_CREDENTIALS = {
  user: 'testuser',
  pass: 'testpass',
  token: 'test-token-secret',
} as const;

async function allHealthy(): Promise<boolean> {
  try {
    await Promise.all(
      Object.values(NATS_TEST_SERVERS).map(async ({ monitor }) => {
        const res = await fetch(`${monitor}/healthz`, { signal: AbortSignal.timeout(1000) });
        if (!res.ok) throw new Error(`unhealthy: ${monitor}`);
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export async function ensureNatsTestEnv(): Promise<() => void> {
  if (await allHealthy()) {
    return () => {};
  }

  execSync(`docker compose -f "${COMPOSE_FILE}" up -d --wait`, { stdio: 'inherit' });
  return () => {
    execSync(`docker compose -f "${COMPOSE_FILE}" down`, { stdio: 'inherit' });
  };
}
