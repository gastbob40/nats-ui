import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subjectTracker } from '@/services/subject-tracker';

describe('subject tracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    subjectTracker.clear();
  });

  afterEach(() => {
    subjectTracker.clear();
    vi.useRealTimers();
  });

  it('records a new subject with its first message', () => {
    subjectTracker.track('orders.new', 'hello');

    const [activity] = subjectTracker.getSubjects();
    expect(activity.subject).toBe('orders.new');
    expect(activity.messageCount).toBe(1);
    expect(activity.lastMessage).toBe('hello');
  });

  it('increments the count and refreshes lastSeen on repeat traffic', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    subjectTracker.track('orders.new');
    vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
    subjectTracker.track('orders.new', 'second');

    const [activity] = subjectTracker.getSubjects();
    expect(activity.messageCount).toBe(2);
    expect(activity.lastMessage).toBe('second');
    expect(activity.lastSeen.toISOString()).toBe('2026-01-01T00:01:00.000Z');
  });

  it('keeps the previous message preview when a track has no payload', () => {
    subjectTracker.track('orders.new', 'first');
    subjectTracker.track('orders.new');

    expect(subjectTracker.getSubjects()[0].lastMessage).toBe('first');
  });

  it('truncates long message previews to 50 characters', () => {
    subjectTracker.track('orders.new', 'x'.repeat(80));

    const preview = subjectTracker.getSubjects()[0].lastMessage;
    expect(preview).toBe('x'.repeat(50) + '...');
  });

  it('truncates previews on repeat traffic too', () => {
    subjectTracker.track('orders.new', 'short');
    subjectTracker.track('orders.new', 'y'.repeat(80));

    expect(subjectTracker.getSubjects()[0].lastMessage).toBe('y'.repeat(50) + '...');
  });

  it('sorts subjects by most recent activity', () => {
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    subjectTracker.track('old.subject');
    vi.setSystemTime(new Date('2026-01-01T00:01:00Z'));
    subjectTracker.track('fresh.subject');

    expect(subjectTracker.getSubjects().map((s) => s.subject)).toEqual(['fresh.subject', 'old.subject']);
  });

  it('limits getRecentSubjects to the requested count', () => {
    for (let i = 0; i < 15; i++) {
      vi.setSystemTime(new Date(2026, 0, 1, 0, i));
      subjectTracker.track(`subject.${i}`);
    }

    expect(subjectTracker.getRecentSubjects()).toHaveLength(10);
    expect(subjectTracker.getRecentSubjects(3).map((s) => s.subject)).toEqual([
      'subject.14',
      'subject.13',
      'subject.12',
    ]);
  });

  it('notifies subscribers on track and clear, and stops after unsubscribe', () => {
    const listener = vi.fn();
    const unsubscribe = subjectTracker.subscribe(listener);

    subjectTracker.track('orders.new');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.lastCall?.[0]).toHaveLength(1);

    subjectTracker.clear();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.lastCall?.[0]).toEqual([]);

    unsubscribe();
    subjectTracker.track('orders.new');
    expect(listener).toHaveBeenCalledTimes(2);

    // A second unsubscribe of the same listener is harmless.
    expect(() => unsubscribe()).not.toThrow();
  });
});
