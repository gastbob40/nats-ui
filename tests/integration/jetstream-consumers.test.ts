import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NatsConnection } from '@nats-io/transport-node';
import { createNatsService, type NatsService } from '@/services/nats-service';
import { NATS_TEST_SERVERS } from '../support/nats-test-env';
import { connectNodeClient, createDurableConsumer, eventually, uniq } from '../support/nats-client';

describe('JetStreamManager consumers', () => {
  let service: NatsService;
  let nodeClient: NatsConnection;
  let stream: string;

  beforeAll(async () => {
    service = await createNatsService([NATS_TEST_SERVERS.main.ws]);
    nodeClient = await connectNodeClient();

    stream = uniq('IT_CONSUMERS');
    await service.jetstream.createStream({
      name: stream,
      subjects: [`${stream}.>`],
      retention: 'limits',
      storage: 'memory',
      maxMsgs: 1000,
      maxBytes: 1024 * 1024,
      maxAge: 0,
      replicas: 1,
    });
  });

  afterAll(async () => {
    await service.jetstream.deleteStream(stream).catch(() => {});
    await service.close();
    await nodeClient.close();
  });

  it('lists, inspects and deletes consumers on a stream', async () => {
    const keeper = uniq('keeper');
    const goner = uniq('goner');
    await createDurableConsumer(nodeClient, stream, keeper);
    await createDurableConsumer(nodeClient, stream, goner);

    const consumers = await service.jetstream.listConsumers(stream);
    const names = consumers.map((c) => c.name);
    expect(names).toContain(keeper);
    expect(names).toContain(goner);

    const info = await service.jetstream.getConsumerInfo(stream, keeper);
    expect(info?.name).toBe(keeper);
    expect((info?.config as Record<string, unknown>).durable_name).toBe(keeper);
    expect((info?.config as Record<string, unknown>).ack_policy).toBe('explicit');

    await service.jetstream.deleteConsumer(stream, goner);
    const remaining = await service.jetstream.listConsumers(stream);
    expect(remaining.map((c) => c.name)).not.toContain(goner);
    expect(remaining.map((c) => c.name)).toContain(keeper);
  });

  it('reports pending messages for a consumer', async () => {
    const consumer = uniq('pending');
    await createDurableConsumer(nodeClient, stream, consumer);

    nodeClient.publish(`${stream}.orders`, 'one');
    nodeClient.publish(`${stream}.orders`, 'two');
    await nodeClient.flush();

    await eventually(async () => {
      const info = await service.jetstream.getConsumerInfo(stream, consumer);
      expect(info?.num_pending).toBe(2);
    });
  });

  it('returns an empty list for a missing stream', async () => {
    await expect(service.jetstream.listConsumers(uniq('IT_MISSING'))).resolves.toEqual([]);
  });

  it('returns the API error envelope for a missing consumer', async () => {
    const info = await service.jetstream.getConsumerInfo(stream, uniq('IT_MISSING'));
    // Current behavior: the raw JetStream response is returned as-is.
    expect(info?.error).toBeDefined();
  });
});
