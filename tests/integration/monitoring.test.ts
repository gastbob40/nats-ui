import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { NatsConnection } from '@nats-io/transport-node';
import {
  createNatsService,
  fetchActiveSubjects,
  fetchAllConsumers,
  fetchJetStreamInfo,
  fetchJetStreamStreams,
  fetchNatsConnections,
  fetchNatsInfo,
  setMonitoringUrl,
  type NatsService,
} from '@/services/nats-service';
import { NATS_TEST_SERVERS } from '../support/nats-test-env';
import { connectNodeClient, createDurableConsumer, eventually, uniq } from '../support/nats-client';

describe('monitoring API fetchers', () => {
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

  afterEach(() => {
    // Reset the module-level base URL to the build-time default.
    setMonitoringUrl(undefined);
  });

  it('fetches server info from /varz', async () => {
    const info = await fetchNatsInfo();
    expect(info?.server_id).toBeTypeOf('string');
    expect(info?.version).toBeTypeOf('string');
  });

  it('fetches connections from /connz, including this websocket client', async () => {
    const data = await fetchNatsConnections();
    expect(Array.isArray(data?.connections)).toBe(true);

    const names = (data?.connections as Record<string, unknown>[]).map((c) => c.name);
    expect(names).toContain('NATS UI Client');
  });

  it('fetches JetStream stats from /jsz', async () => {
    const info = await fetchJetStreamInfo();
    expect(info?.config).toBeDefined();
    expect(info?.streams).toBeTypeOf('number');
  });

  it('lists active subjects from live subscriptions', async () => {
    const subject = `${uniq('it_monitor')}.active`;
    const sub = nodeClient.subscribe(subject);
    await nodeClient.flush();

    await eventually(async () => {
      expect(await fetchActiveSubjects()).toContain(subject);
    });

    sub.unsubscribe();
  });

  it('lists streams with their config through /jsz', async () => {
    const name = uniq('IT_MONITOR');
    createdStreams.push(name);
    await service.jetstream.createStream({
      name,
      subjects: [`${name}.>`],
      retention: 'limits',
      storage: 'memory',
      maxMsgs: 100,
      maxBytes: 1024 * 1024,
      maxAge: 0,
      replicas: 1,
    });

    await eventually(async () => {
      const streams = await fetchJetStreamStreams();
      const match = streams.find((s) => (s.config as Record<string, unknown> | undefined)?.name === name);
      expect(match).toBeDefined();
      expect(match?.state).toBeDefined();
    });
  });

  it('lists consumers tagged with their stream through /jsz', async () => {
    const name = uniq('IT_MONITOR');
    createdStreams.push(name);
    await service.jetstream.createStream({
      name,
      subjects: [`${name}.>`],
      retention: 'limits',
      storage: 'memory',
      maxMsgs: 100,
      maxBytes: 1024 * 1024,
      maxAge: 0,
      replicas: 1,
    });
    const consumer = uniq('monitor_consumer');
    await createDurableConsumer(nodeClient, name, consumer);

    await eventually(async () => {
      const consumers = await fetchAllConsumers();
      const match = consumers.find((c) => c.name === consumer);
      expect(match).toBeDefined();
      expect(match?.stream_name).toBe(name);
    });
  });

  it('trims trailing slashes from a configured monitoring URL', async () => {
    setMonitoringUrl(`${NATS_TEST_SERVERS.main.monitor}///`);
    expect((await fetchNatsInfo())?.server_id).toBeTypeOf('string');
  });

  it('degrades gracefully when the monitoring API is unreachable', async () => {
    setMonitoringUrl('http://localhost:59999');

    expect(await fetchNatsInfo()).toBeNull();
    expect(await fetchNatsConnections()).toBeNull();
    expect(await fetchJetStreamInfo()).toBeNull();
    expect(await fetchActiveSubjects()).toEqual([]);
    expect(await fetchJetStreamStreams()).toEqual([]);
    expect(await fetchAllConsumers()).toEqual([]);
  });

  it('degrades gracefully on non-OK responses', async () => {
    // /varz/varz etc. answer 404 on the real server.
    setMonitoringUrl(`${NATS_TEST_SERVERS.main.monitor}/varz`);

    expect(await fetchNatsInfo()).toBeNull();
    expect(await fetchNatsConnections()).toBeNull();
    expect(await fetchJetStreamInfo()).toBeNull();
    expect(await fetchActiveSubjects()).toEqual([]);
    expect(await fetchJetStreamStreams()).toEqual([]);
    expect(await fetchAllConsumers()).toEqual([]);
  });
});
