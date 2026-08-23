import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNatsService, type NatsService } from '@/services/nats-service';
import { NATS_TEST_SERVERS } from '../support/nats-test-env';
import { uniq } from '../support/nats-client';

describe('JetStreamManager KV store', () => {
  let service: NatsService;
  const createdBuckets: string[] = [];
  const createdStreams: string[] = [];

  beforeAll(async () => {
    service = await createNatsService([NATS_TEST_SERVERS.main.ws]);
  });

  afterAll(async () => {
    for (const bucket of createdBuckets) {
      await service.jetstream.deleteKVBucket(bucket).catch(() => {});
    }
    for (const stream of createdStreams) {
      await service.jetstream.deleteStream(stream).catch(() => {});
    }
    await service.close();
  });

  async function createBucket(ttl?: number): Promise<string> {
    const bucket = uniq('IT_KV');
    createdBuckets.push(bucket);
    await service.jetstream.createKVBucket(bucket, ttl);
    return bucket;
  }

  it('creates a bucket backed by a KV-shaped stream', async () => {
    const bucket = await createBucket();

    expect(await service.jetstream.listKVBuckets()).toContain(bucket);

    const info = await service.jetstream.getStreamInfo(`KV_${bucket}`);
    const config = info?.config as Record<string, unknown>;
    expect(config.max_msgs_per_subject).toBe(1);
    expect(config.allow_direct).toBe(true);
    expect(config.subjects).toEqual([`$KV.${bucket}.>`]);
    expect(config.max_age).toBe(0);
  });

  it('applies the TTL to max_age and caps the duplicate window', async () => {
    const shortTtl = await createBucket(60);
    const shortConfig = (await service.jetstream.getStreamInfo(`KV_${shortTtl}`))?.config as Record<string, unknown>;
    expect(shortConfig.max_age).toBe(60 * 1_000_000_000);
    expect(shortConfig.duplicate_window).toBe(60 * 1_000_000_000);

    const longTtl = await createBucket(300);
    const longConfig = (await service.jetstream.getStreamInfo(`KV_${longTtl}`))?.config as Record<string, unknown>;
    expect(longConfig.max_age).toBe(300 * 1_000_000_000);
    expect(longConfig.duplicate_window).toBe(120 * 1_000_000_000);
  });

  it('excludes regular streams from the bucket list', async () => {
    const stream = uniq('IT_NOT_KV');
    createdStreams.push(stream);
    await service.jetstream.createStream({
      name: stream,
      subjects: [`${stream}.>`],
      retention: 'limits',
      storage: 'memory',
      maxMsgs: 100,
      maxBytes: 1024 * 1024,
      maxAge: 0,
      replicas: 1,
    });

    expect(await service.jetstream.listKVBuckets()).not.toContain(stream);
  });

  it('puts and gets values, latest write wins', async () => {
    const bucket = await createBucket();

    await service.jetstream.putKVValue(bucket, 'color', 'blue');
    expect(await service.jetstream.getKVValue(bucket, 'color')).toBe('blue');

    await service.jetstream.putKVValue(bucket, 'color', 'green');
    expect(await service.jetstream.getKVValue(bucket, 'color')).toBe('green');
  });

  it('lists the keys of a bucket', async () => {
    const bucket = await createBucket();

    await service.jetstream.putKVValue(bucket, 'alpha', '1');
    await service.jetstream.putKVValue(bucket, 'beta', '2');

    const keys = await service.jetstream.getKVKeys(bucket);
    expect(keys.sort()).toEqual(['alpha', 'beta']);
  });

  it('lists keys across sequence gaps left by overwrites', async () => {
    const bucket = await createBucket();

    // Overwriting removes the old sequence (max_msgs_per_subject: 1).
    // Rewriting the middle key leaves a hole inside [first_seq, last_seq]
    // that the key scan has to skip without dropping keys.
    await service.jetstream.putKVValue(bucket, 'alpha', 'v1');
    await service.jetstream.putKVValue(bucket, 'beta', 'v1');
    await service.jetstream.putKVValue(bucket, 'gamma', 'v1');
    await service.jetstream.putKVValue(bucket, 'beta', 'v2');

    const keys = await service.jetstream.getKVKeys(bucket);
    expect(keys.sort()).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('rejects recreating a bucket with a different TTL', async () => {
    const bucket = await createBucket(60);
    await expect(service.jetstream.createKVBucket(bucket, 300)).rejects.toThrow(/JetStream API error/);
  });

  it('returns an empty key list for an empty or missing bucket', async () => {
    const bucket = await createBucket();
    expect(await service.jetstream.getKVKeys(bucket)).toEqual([]);
    expect(await service.jetstream.getKVKeys(uniq('IT_KV_MISSING'))).toEqual([]);
  });

  it('returns null for a missing key', async () => {
    const bucket = await createBucket();
    expect(await service.jetstream.getKVValue(bucket, 'nope')).toBeNull();
  });

  it('deletes a key: the value is gone but the DEL marker keeps the key listed', async () => {
    const bucket = await createBucket();
    await service.jetstream.putKVValue(bucket, 'doomed', 'value');

    await service.jetstream.deleteKVKey(bucket, 'doomed');

    expect(await service.jetstream.getKVValue(bucket, 'doomed')).toBeNull();
    // Current behavior: getKVKeys scans raw stream messages, and the DEL
    // marker still carries the key's subject.
    expect(await service.jetstream.getKVKeys(bucket)).toContain('doomed');
  });

  it('deletes a bucket', async () => {
    const bucket = await createBucket();

    await service.jetstream.deleteKVBucket(bucket);

    expect(await service.jetstream.listKVBuckets()).not.toContain(bucket);
  });
});
