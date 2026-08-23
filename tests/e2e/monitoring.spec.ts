import { expect, openApp, test } from './fixtures';

test.describe('dashboard and monitoring', () => {
  test('dashboard shows the connection and server stats', async ({ page }) => {
    await openApp(page, '/');

    // SidebarInset renders as <main>, so the page content is the nested one.
    await expect(page.locator('main main').getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText('Connection Status', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('ws://localhost:9222').first()).toBeVisible();
  });

  test('monitoring renders live server metrics from the HTTP API', async ({ page }) => {
    await openApp(page, '/monitoring');

    await expect(page.getByRole('heading', { name: 'Monitoring' })).toBeVisible();
    await expect(page.getByText('Messages Processed', { exact: true })).toBeVisible();
    await expect(page.getByText('Active Connections', { exact: true }).first()).toBeVisible();

    // The System tab shows /varz data such as the server version.
    await page.getByRole('tab', { name: 'System' }).click();
    await expect(page.getByText('Version', { exact: true })).toBeVisible();
    await expect(page.getByText(/^2\.\d+\.\d+/).first()).toBeVisible();
  });
});
