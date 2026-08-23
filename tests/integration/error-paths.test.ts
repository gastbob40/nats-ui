import { beforeAll, describe, expect, it } from 'vitest';
import { createNatsService, type NatsService } from '@/services/nats-service';
import { NATS_TEST_SERVERS } from '../support/nats-test-env';

// Every JetStreamManager call funnels through connection.request, which throws
// once the connection is gone. This pins the contract pages rely on: list
// operations degrade to empty results, lookups to null, mutations reject.
describe('service behavior on a closed connection', () => {
  let service: NatsService;

  beforeAll(async () => {
    service = await createNatsService([NATS_TEST_SERVERS.main.ws]);
    await service.close();
  });

  it('rejects publishes', async () => {
    await expect(service.publish('any.subject', 'data')).rejects.toThrow();
  });

  it('rejects stream mutations', async () => {
    await expect(
      service.jetstream.createStream({
        name: 'CLOSED_STREAM',
        subjects: ['closed.>'],
        retention: 'limits',
        storage: 'memory',
        maxMsgs: 1,
        maxBytes: 1024,
        maxAge: 0,
        replicas: 1,
      }),
    ).rejects.toThrow();
    await expect(service.jetstream.deleteStream('CLOSED_STREAM')).rejects.toThrow();
    await expect(service.jetstream.deleteConsumer('CLOSED_STREAM', 'c')).rejects.toThrow();
  });

  it('degrades reads to empty results or null', async () => {
    expect(await service.jetstream.listStreams()).toEqual([]);
    expect(await service.jetstream.getStreamInfo('ANY')).toBeNull();
    expect(await service.jetstream.listConsumers('ANY')).toEqual([]);
    expect(await service.jetstream.getConsumerInfo('ANY', 'c')).toBeNull();
    expect(await service.jetstream.listKVBuckets()).toEqual([]);
    expect(await service.jetstream.getKVKeys('ANY')).toEqual([]);
    expect(await service.jetstream.getKVValue('ANY', 'key')).toBeNull();
  });

  it('rejects KV mutations', async () => {
    await expect(service.jetstream.createKVBucket('closedbucket')).rejects.toThrow();
    await expect(service.jetstream.deleteKVBucket('closedbucket')).rejects.toThrow();
    await expect(service.jetstream.putKVValue('closedbucket', 'k', 'v')).rejects.toThrow();
    await expect(service.jetstream.deleteKVKey('closedbucket', 'k')).rejects.toThrow();
  });
});
