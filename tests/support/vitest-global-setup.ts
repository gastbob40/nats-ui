import { ensureNatsTestEnv } from './nats-test-env';

export default async function setup(): Promise<() => void> {
  return ensureNatsTestEnv();
}
