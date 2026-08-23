import { ensureNatsTestEnv } from '../support/nats-test-env';

// Returning the teardown makes Playwright stop the compose stack after the
// run, but only when this setup was the one that started it.
export default async function globalSetup(): Promise<() => void> {
  return ensureNatsTestEnv();
}
