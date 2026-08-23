import { expect, openApp, test } from './fixtures';
import { NATS_TEST_CREDENTIALS, NATS_TEST_SERVERS } from '../support/nats-test-env';

test.describe('connection lifecycle', () => {
  test('auto-connects to the endpoints derived from the page host', async ({ page }) => {
    await openApp(page);

    await expect(page.getByText('HTTP: Available')).toBeVisible({ timeout: 15_000 });
    // SidebarInset renders as <main>, so the page content is the nested one.
    await expect(page.locator('main main').getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });

  test('reports an unreachable server with the attempted URL', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'nats-ui-config',
        JSON.stringify({ server: 'ws://localhost:59998', httpUrl: '' }),
      );
    });
    await page.goto('/');

    await expect(page.getByText('WS: Error')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Connection Failed' })).toBeVisible();
    await expect(page.getByText('no WebSocket server answered').first()).toBeVisible();
  });

  test('authenticates with user/password through the settings form', async ({ page }) => {
    await page.goto('/settings');

    await page.getByLabel('WebSocket Server URL').fill(NATS_TEST_SERVERS.authUser.ws);
    await page.getByLabel('HTTP Monitoring URL').fill(NATS_TEST_SERVERS.authUser.monitor);
    await page.getByLabel('Username', { exact: true }).fill(NATS_TEST_CREDENTIALS.user);
    await page.getByLabel('Password', { exact: true }).fill(NATS_TEST_CREDENTIALS.pass);
    await page.getByRole('button', { name: 'Save Connection Settings' }).click();
    await expect(page.getByText('Connection settings saved')).toBeVisible();

    // Saving only persists the config; the reload applies it via auto-connect.
    await page.reload();
    await expect(page.getByText('WS: Connected')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Username/Password', { exact: true })).toBeVisible();
  });

  test('authenticates with a token', async ({ page }) => {
    await page.addInitScript(
      ({ server, token }) => {
        localStorage.setItem('nats-ui-config', JSON.stringify({ server, token, httpUrl: '' }));
      },
      { server: NATS_TEST_SERVERS.authToken.ws, token: NATS_TEST_CREDENTIALS.token },
    );
    await page.goto('/settings');

    await expect(page.getByText('WS: Connected')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Token', { exact: true })).toBeVisible();
  });

  test('rejects wrong credentials', async ({ page }) => {
    await page.addInitScript(
      ({ server, user }) => {
        localStorage.setItem(
          'nats-ui-config',
          JSON.stringify({ server, user, pass: 'wrong-password', httpUrl: '' }),
        );
      },
      { server: NATS_TEST_SERVERS.authUser.ws, user: NATS_TEST_CREDENTIALS.user },
    );
    await page.goto('/');

    await expect(page.getByText('WS: Error')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'Connection Failed' })).toBeVisible();
  });
});
