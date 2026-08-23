/**
 * Node-side NATS helpers for the integration and e2e suites.
 *
 * The suites drive the browser-facing code (ws) and use this plain TCP client
 * to seed server state and verify side effects independently.
 */
import { connect, type NatsConnection } from '@nats-io/transport-node';
import { jetstreamManager, type JetStreamManager } from '@nats-io/jetstream';
import { NATS_TEST_SERVERS } from './nats-test-env';

export async function connectNodeClient(): Promise<NatsConnection> {
  return connect({ servers: [NATS_TEST_SERVERS.main.client], name: 'test-support-client' });
}

export async function nodeJetStreamManager(nc: NatsConnection): Promise<JetStreamManager> {
  return jetstreamManager(nc);
}

/** Creates a durable pull consumer through the raw JetStream API. */
export async function createDurableConsumer(nc: NatsConnection, stream: string, name: string): Promise<void> {
  const response = await nc.request(
    `$JS.API.CONSUMER.DURABLE.CREATE.${stream}.${name}`,
    JSON.stringify({ stream_name: stream, config: { durable_name: name, ack_policy: 'explicit' } }),
    { timeout: 5000 },
  );
  const result = JSON.parse(new TextDecoder().decode(response.data));
  if (result.error) {
    throw new Error(`Failed to create consumer ${name}: ${result.error.description}`);
  }
}

let counter = 0;

/** Unique resource name so parallel tests never collide on the shared server. */
export function uniq(prefix: string): string {
  counter += 1;
  return `${prefix}_${process.pid.toString(36)}_${Date.now().toString(36)}_${counter}`;
}

/** Polls an assertion until it stops throwing or the timeout expires. */
export async function eventually<T>(
  fn: () => T | Promise<T>,
  { timeout = 5000, interval = 100 }: { timeout?: number; interval?: number } = {},
): Promise<T> {
  const deadline = Date.now() + timeout;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (Date.now() >= deadline) throw error;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}
