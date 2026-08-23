import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NatsConnection } from '@nats-io/transport-node';
import { createNatsService, type NatsService } from '@/services/nats-service';
import { subjectTracker } from '@/services/subject-tracker';
import { NATS_TEST_SERVERS } from '../support/nats-test-env';
import { connectNodeClient, eventually, uniq } from '../support/nats-client';

type ReceivedMessage = {
  subject: string;
  data: unknown;
  headers?: Record<string, string>;
  timestamp: number;
  reply?: string;
};

// These tests exercise the exact code path the browser uses (wsconnect over
// WebSocket) against a real NATS server; Node >= 22 provides the WebSocket
// global that nats-core picks up.
describe('NatsService over WebSocket', () => {
  let service: NatsService;
  let nodeClient: NatsConnection;

  beforeAll(async () => {
    service = await createNatsService([NATS_TEST_SERVERS.main.ws]);
    nodeClient = await connectNodeClient();
  });

  afterAll(async () => {
    await service.close();
    await nodeClient.close();
  });

  async function collect(subject: string): Promise<{ messages: ReceivedMessage[]; unsubscribe: () => void }> {
    const messages: ReceivedMessage[] = [];
    const unsubscribe = await service.subscribe(subject, (msg) => messages.push(msg));
    return { messages, unsubscribe };
  }

  it('round-trips object payloads as JSON', async () => {
    const subject = `${uniq('it_svc')}.json`;
    const { messages } = await collect(subject);

    await service.publish(subject, { hello: 'world', count: 3 });

    await eventually(() => expect(messages).toHaveLength(1));
    expect(messages[0].subject).toBe(subject);
    expect(messages[0].data).toEqual({ hello: 'world', count: 3 });
    expect(messages[0].timestamp).toBeTypeOf('number');
  });

  it('passes non-JSON strings through untouched', async () => {
    const subject = `${uniq('it_svc')}.text`;
    const { messages } = await collect(subject);

    await service.publish(subject, 'plain text payload');

    await eventually(() => expect(messages).toHaveLength(1));
    expect(messages[0].data).toBe('plain text payload');
  });

  it('parses JSON strings on the receiving side', async () => {
    const subject = `${uniq('it_svc')}.jsonstring`;
    const { messages } = await collect(subject);

    await service.publish(subject, '{"parsed": true}');

    await eventually(() => expect(messages).toHaveLength(1));
    expect(messages[0].data).toEqual({ parsed: true });
  });

  it('delivers custom headers', async () => {
    const subject = `${uniq('it_svc')}.headers`;
    const { messages } = await collect(subject);

    await service.publish(subject, 'with headers', { 'X-Trace-Id': 'abc-123', 'X-Origin': 'test' });

    await eventually(() => expect(messages).toHaveLength(1));
    expect(messages[0].headers).toMatchObject({ 'X-Trace-Id': 'abc-123', 'X-Origin': 'test' });
  });

  it('supports wildcard subscriptions', async () => {
    const base = uniq('it_wild');
    const { messages } = await collect(`${base}.*`);

    await service.publish(`${base}.alpha`, 'a');
    await service.publish(`${base}.beta`, 'b');

    await eventually(() => expect(messages).toHaveLength(2));
    expect(messages.map((m) => m.subject).sort()).toEqual([`${base}.alpha`, `${base}.beta`]);
  });

  it('stops delivering after unsubscribe', async () => {
    const subject = `${uniq('it_svc')}.unsub`;
    const { messages, unsubscribe } = await collect(subject);

    await service.publish(subject, 'first');
    await eventually(() => expect(messages).toHaveLength(1));

    unsubscribe();
    await service.publish(subject, 'second');
    await nodeClient.flush();
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(messages).toHaveLength(1);
  });

  it('exposes the reply subject so a request can be answered', async () => {
    const subject = `${uniq('it_svc')}.echo`;
    await service.subscribe(subject, (msg) => {
      if (msg.reply) {
        void service.publish(msg.reply, `pong:${String(msg.data)}`);
      }
    });
    // Subscription interest must reach the server before the request fires.
    await service.connection.flush();

    const response = await nodeClient.request(subject, 'ping', { timeout: 5000 });
    expect(new TextDecoder().decode(response.data)).toBe('pong:ping');
  });

  it('tracks published and received subjects', async () => {
    const subject = `${uniq('it_track')}.activity`;
    const { messages } = await collect(subject);

    await service.publish(subject, 'tracked');
    await eventually(() => expect(messages).toHaveLength(1));

    const tracked = subjectTracker.getSubjects().find((s) => s.subject === subject);
    expect(tracked).toBeDefined();
    // Publish and receive both count.
    expect(tracked?.messageCount).toBe(2);
    expect(tracked?.lastMessage).toBe('tracked');
  });

  it('keeps processing messages when a subscriber callback throws', async () => {
    const subject = `${uniq('it_svc')}.cbthrow`;
    const survived: unknown[] = [];
    await service.subscribe(subject, (msg) => {
      if (msg.data === 'boom') {
        throw new Error('subscriber blew up');
      }
      survived.push(msg.data);
    });

    await service.publish(subject, 'boom');
    await service.publish(subject, 'still alive');

    await eventually(() => expect(survived).toEqual(['still alive']));
  });

  it('reports closed state after close()', async () => {
    const shortLived = await createNatsService([NATS_TEST_SERVERS.main.ws]);
    expect(shortLived.isClosed()).toBe(false);

    await shortLived.close();
    expect(shortLived.isClosed()).toBe(true);
  });

  it('rejects when no server listens on the target port', async () => {
    await expect(createNatsService(['ws://localhost:19999'])).rejects.toThrow();
  });
});
