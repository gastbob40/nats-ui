import { test as base, expect, type Page } from '@playwright/test';
import { connect, type NatsConnection } from '@nats-io/transport-node';
import { NATS_TEST_SERVERS } from '../support/nats-test-env';

type NatsFixtures = {
  /** Node-side NATS client on the same server the browser talks to. */
  nc: NatsConnection;
};

export const test = base.extend<NatsFixtures>({
  // The provider callback is Playwright's `use`, renamed so the react-hooks
  // lint rule does not mistake it for React's use().
  // eslint-disable-next-line no-empty-pattern
  nc: async ({}, provide) => {
    const nc = await connect({ servers: [NATS_TEST_SERVERS.main.client], name: 'e2e-support' });
    await provide(nc);
    await nc.close();
  },
});

export { expect };
export { uniq, createDurableConsumer, createKVBucketRaw, createStreamRaw, deleteStreamRaw, getStreamInfoRaw, jsApiRequest, putKVRaw } from '../support/nats-client';

/** Opens the app and waits until the WebSocket connection is up. */
export async function openApp(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(page.getByText('WS: Connected')).toBeVisible({ timeout: 15_000 });
}
