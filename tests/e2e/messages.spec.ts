import { headers as createHeaders } from '@nats-io/nats-core';
import { expect, openApp, test, uniq } from './fixtures';

/** Adds a custom topic through the dialog; the app selects it automatically. */
async function addTopic(page: import('@playwright/test').Page, topic: string): Promise<void> {
  await page.getByRole('button', { name: 'Add custom topic' }).click();
  await page.getByLabel('Topic Name').fill(topic);
  await page.getByRole('button', { name: 'Add Topic' }).click();
}

test.describe('messages', () => {
  test('subscribes to a topic and receives live messages', async ({ page, nc }) => {
    const topic = uniq('e2e.receive');
    await openApp(page, '/messages');
    await addTopic(page, topic);

    await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
    await expect(page.getByText(`Subscribed to ${topic}`)).toBeVisible();

    nc.publish(topic, 'hello from the node client');
    await nc.flush();

    await expect(page.getByText(`Messages for ${topic} (1)`)).toBeVisible();
    await expect(page.getByText('hello from the node client')).toBeVisible();
  });

  test('publishes a message with headers from the UI', async ({ page, nc }) => {
    const topic = uniq('e2e.publish');
    const sub = nc.subscribe(topic, { max: 1 });
    const firstMessage = (async () => {
      for await (const msg of sub) return msg;
      throw new Error('subscription closed without a message');
    })();
    await nc.flush();

    await openApp(page, '/messages');
    await addTopic(page, topic);

    await page.getByLabel('Message Data').fill('{"from":"ui","n":7}');
    await page.getByLabel('Headers (JSON, optional)').fill('{"X-E2E":"yes"}');
    await page.getByRole('button', { name: 'Publish Message' }).click();
    await expect(page.getByText(`Message published to ${topic}`)).toBeVisible();

    const received = await firstMessage;
    expect(received.string()).toBe('{"from":"ui","n":7}');
    expect(received.headers?.get('X-E2E')).toBe('yes');
  });

  test('rejects invalid JSON in the headers field', async ({ page }) => {
    const topic = uniq('e2e.badheaders');
    await openApp(page, '/messages');
    await addTopic(page, topic);

    await page.getByLabel('Message Data').fill('payload');
    await page.getByLabel('Headers (JSON, optional)').fill('{not json');
    await page.getByRole('button', { name: 'Publish Message' }).click();

    await expect(page.getByText('Invalid JSON in headers field')).toBeVisible();
  });

  test('displays incoming message headers', async ({ page, nc }) => {
    const topic = uniq('e2e.headers');
    await openApp(page, '/messages');
    await addTopic(page, topic);
    await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
    await expect(page.getByText(`Subscribed to ${topic}`)).toBeVisible();

    const headers = createHeaders();
    headers.append('X-Origin', 'node-e2e');
    nc.publish(topic, 'with headers', { headers });
    await nc.flush();

    await page.getByText('Headers (1)').click();
    await expect(page.getByText('X-Origin:')).toBeVisible();
    await expect(page.getByText('node-e2e')).toBeVisible();
  });

  test('clears received messages and unsubscribes', async ({ page, nc }) => {
    const topic = uniq('e2e.clear');
    await openApp(page, '/messages');
    await addTopic(page, topic);
    await page.getByRole('button', { name: 'Subscribe', exact: true }).click();
    await expect(page.getByText(`Subscribed to ${topic}`)).toBeVisible();

    nc.publish(topic, 'to be cleared');
    await nc.flush();
    await expect(page.getByText(`Messages for ${topic} (1)`)).toBeVisible();

    await page.getByTitle('Clear messages').click();
    await expect(page.getByText('Messages cleared')).toBeVisible();
    await expect(page.getByText(`Messages for ${topic} (0)`)).toBeVisible();

    await page.getByTitle('Unsubscribe from topic').click();
    await expect(page.getByText('Unsubscribed', { exact: true })).toBeVisible();
    await expect(page.getByText('Subscribed', { exact: true })).toBeHidden();
  });

  test('persists custom topics across reloads and removes them', async ({ page }) => {
    const topic = uniq('e2e.bookmark');
    await openApp(page, '/messages');
    await addTopic(page, topic);
    await expect(page.getByText(topic, { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText('WS: Connected')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(topic, { exact: true })).toBeVisible();

    const row = page.locator('.cursor-pointer').filter({ hasText: topic });
    await row.getByTitle('Remove custom topic').click();
    await expect(page.getByText(topic, { exact: true })).toBeHidden();
  });
});
