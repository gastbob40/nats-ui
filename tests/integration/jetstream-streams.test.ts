import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NatsConnection } from '@nats-io/transport-node';
import { createNatsService, type NatsService } from '@/services/nats-service';
import { NATS_TEST_SERVERS } from '../support/nats-test-env';
import { connectNodeClient, eventually, uniq } from '../support/nats-client';

type StreamConfigInput = Parameters<NatsService['jetstream']['createStream']>[0];

describe('JetStreamManager streams', () => {
  let service: NatsService;
  let nodeClient: NatsConnection;
  const createdStreams: string[] = [];

  beforeAll(async () => {
    service = await createNatsService([NATS_TEST_SERVERS.main.ws]);
    nodeClient = await connectNodeClient();
  });

  afterAll(async () => {
    for (const name of createdStreams) {
      await service.jetstream.deleteStream(name).catch(() => {});
    }
    await service.close();
    await nodeClient.close();
  });

  function streamConfig(name: string, overrides: Partial<StreamConfigInput> = {}): StreamConfigInput {
    return {
      name,
      subjects: [`${name}.>`],
      retention: 'limits',
      storage: 'memory',
      maxMsgs: 1000,
      maxBytes: 1024 * 1024,
      maxAge: 0,
      replicas: 1,
      ...overrides,
    };
  }

  async function createStream(overrides: Partial<StreamConfigInput> = {}): Promise<string> {
    const name = uniq('IT_STREAM');
    createdStreams.push(name);
    await service.jetstream.createStream(streamConfig(name, overrides));
    return name;
  }

  it.each(['limits', 'interest', 'workqueue'] as const)('creates a stream with %s retention', async (retention) => {
    const name = uniq('IT_STREAM');
    createdStreams.push(name);

    const result = await service.jetstream.createStream(streamConfig(name, { retention }));
    const config = result.config as Record<string, unknown>;

    expect(config.name).toBe(name);
    expect(config.retention).toBe(retention);
  });

  it.each(['memory', 'file'] as const)('creates a stream with %s storage', async (storage) => {
    const name = uniq('IT_STREAM');
    createdStreams.push(name);

    const result = await service.jetstream.createStream(streamConfig(name, { storage }));
    expect((result.config as Record<string, unknown>).storage).toBe(storage);
  });

  it('converts maxAge from seconds to nanoseconds and keeps description', async () => {
    const name = uniq('IT_STREAM');
    createdStreams.push(name);

    const result = await service.jetstream.createStream(
      streamConfig(name, { maxAge: 60, description: 'created by integration tests' }),
    );
    const config = result.config as Record<string, unknown>;

    expect(config.max_age).toBe(60 * 1_000_000_000);
    expect(config.description).toBe('created by integration tests');
  });

  it('surfaces JetStream API errors, e.g. a name reused with other subjects', async () => {
    const name = await createStream();

    await expect(
      service.jetstream.createStream(streamConfig(name, { subjects: ['different.subjects.>'] })),
    ).rejects.toThrow(/JetStream API error/);
  });

  it('lists created streams', async () => {
    const name = await createStream();

    const streams = await service.jetstream.listStreams();
    const names = streams.map((s) => (s.config as Record<string, unknown>).name);
    expect(names).toContain(name);
  });

  it('reports stream state that reflects published messages', async () => {
    const name = await createStream();

    nodeClient.publish(`${name}.events`, 'one');
    nodeClient.publish(`${name}.events`, 'two');
    await nodeClient.flush();

    await eventually(async () => {
      const info = await service.jetstream.getStreamInfo(name);
      expect((info?.state as Record<string, unknown>).messages).toBe(2);
    });
  });

  it('returns the API error envelope for a missing stream', async () => {
    const info = await service.jetstream.getStreamInfo(uniq('IT_MISSING'));
    // Current behavior: the raw JetStream response is returned as-is, the
    // caller has to look at .error itself.
    expect(info?.error).toBeDefined();
  });

  it('deletes a stream', async () => {
    const name = await createStream();

    await service.jetstream.deleteStream(name);

    const streams = await service.jetstream.listStreams();
    const names = streams.map((s) => (s.config as Record<string, unknown>).name);
    expect(names).not.toContain(name);
  });

  it('resolves silently when deleting a missing stream', async () => {
    // Current behavior: the API's "stream not found" error is not surfaced.
    await expect(service.jetstream.deleteStream(uniq('IT_MISSING'))).resolves.toBeUndefined();
  });
});
