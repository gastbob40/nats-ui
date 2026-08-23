import { beforeEach, describe, expect, it } from 'vitest';
import { addCustomTopic, getCustomTopics, removeCustomTopic } from '@/services/custom-topics';

const SERVER = 'ws://localhost:9222';
const OTHER_SERVER = 'ws://other:9222';
const STORAGE_KEY = 'nats-ui-custom-topics';

describe('custom topics', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns an empty list for an unknown server', () => {
    expect(getCustomTopics(SERVER)).toEqual([]);
  });

  it('returns an empty list when no server is given', () => {
    expect(getCustomTopics('')).toEqual([]);
  });

  it('adds, trims, dedupes and sorts topics', () => {
    addCustomTopic(SERVER, 'orders.new');
    addCustomTopic(SERVER, '  alerts.critical  ');
    const result = addCustomTopic(SERVER, 'orders.new');

    expect(result).toEqual(['alerts.critical', 'orders.new']);
    expect(getCustomTopics(SERVER)).toEqual(['alerts.critical', 'orders.new']);
  });

  it('ignores empty or whitespace-only topics', () => {
    addCustomTopic(SERVER, 'orders.new');
    expect(addCustomTopic(SERVER, '   ')).toEqual(['orders.new']);
  });

  it('scopes topics per server URL', () => {
    addCustomTopic(SERVER, 'orders.new');
    addCustomTopic(OTHER_SERVER, 'other.subject');

    expect(getCustomTopics(SERVER)).toEqual(['orders.new']);
    expect(getCustomTopics(OTHER_SERVER)).toEqual(['other.subject']);
  });

  it('removing without a server is a no-op returning an empty list', () => {
    addCustomTopic(SERVER, 'orders.new');
    expect(removeCustomTopic('', 'orders.new')).toEqual([]);
    expect(getCustomTopics(SERVER)).toEqual(['orders.new']);
  });

  it('removes a topic and persists the change', () => {
    addCustomTopic(SERVER, 'orders.new');
    addCustomTopic(SERVER, 'alerts.critical');

    expect(removeCustomTopic(SERVER, 'orders.new')).toEqual(['alerts.critical']);
    expect(getCustomTopics(SERVER)).toEqual(['alerts.critical']);
  });

  it('survives a corrupted store', () => {
    localStorage.setItem(STORAGE_KEY, '"not an object"');
    expect(getCustomTopics(SERVER)).toEqual([]);

    localStorage.setItem(STORAGE_KEY, 'null');
    expect(addCustomTopic(SERVER, 'orders.new')).toEqual(['orders.new']);
  });

  it('survives a non-array entry for a server', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ [SERVER]: 42 }));
    expect(getCustomTopics(SERVER)).toEqual([]);
    expect(addCustomTopic(SERVER, 'orders.new')).toEqual(['orders.new']);
  });
});
