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

/** Sends a raw JetStream API request and returns the parsed response. */
export async function jsApiRequest(
  nc: NatsConnection,
  subject: string,
  payload: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await nc.request(subject, JSON.stringify(payload), { timeout: 5000 });
  return JSON.parse(new TextDecoder().decode(response.data));
}

export async function createStreamRaw(
  nc: NatsConnection,
  name: string,
  subjects: string[],
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const result = await jsApiRequest(nc, `$JS.API.STREAM.CREATE.${name}`, {
    name,
    subjects,
    retention: 'limits',
    storage: 'memory',
    max_msgs: 10000,
    num_replicas: 1,
    ...extra,
  });
  const error = result.error as { description?: string } | undefined;
  if (error) {
    throw new Error(`Failed to create stream ${name}: ${error.description}`);
  }
  return result;
}

/** Returns the stream info envelope; contains .error when the stream is missing. */
export async function getStreamInfoRaw(nc: NatsConnection, name: string): Promise<Record<string, unknown>> {
  return jsApiRequest(nc, `$JS.API.STREAM.INFO.${name}`);
}

/** Best-effort stream deletion for test cleanup. */
export async function deleteStreamRaw(nc: NatsConnection, name: string): Promise<void> {
  await jsApiRequest(nc, `$JS.API.STREAM.DELETE.${name}`).catch(() => {});
}

/** Creates a KV bucket the same way the KV client does (KV_-prefixed stream). */
export async function createKVBucketRaw(nc: NatsConnection, bucket: string): Promise<void> {
  await createStreamRaw(nc, `KV_${bucket}`, [`$KV.${bucket}.>`], {
    max_msgs_per_subject: 1,
    allow_direct: true,
    allow_rollup_hdrs: true,
    discard: 'new',
    storage: 'file',
  });
}

export async function putKVRaw(nc: NatsConnection, bucket: string, key: string, value: string): Promise<void> {
  nc.publish(`$KV.${bucket}.${key}`, value);
  await nc.flush();
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
