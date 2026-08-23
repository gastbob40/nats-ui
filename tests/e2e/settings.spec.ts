import { expect, openApp, test } from './fixtures';

test.describe('settings', () => {
  test('shows the active configuration and connection debug info', async ({ page }) => {
    await openApp(page, '/settings');

    await expect(page.getByLabel('WebSocket Server URL')).toHaveValue('ws://localhost:9222');
    await expect(page.getByLabel('HTTP Monitoring URL')).toHaveValue('http://localhost:8222');
    await expect(page.getByText('Overall Status:')).toBeVisible();
    await expect(page.getByText('Authentication:')).toBeVisible();
    await expect(page.getByText('None', { exact: true })).toBeVisible();
  });

  test('saves connection settings to localStorage', async ({ page }) => {
    await openApp(page, '/settings');

    await page.getByLabel('Client Name').fill('E2E Client');
    await page.getByRole('button', { name: 'Save Connection Settings' }).click();
    await expect(page.getByText('Connection settings saved')).toBeVisible();

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('nats-ui-config') ?? '{}'));
    expect(stored.name).toBe('E2E Client');
    expect(stored.server).toBe('ws://localhost:9222');
  });

  test('resets the form to the built-in defaults', async ({ page }) => {
    await openApp(page, '/settings');

    await page.getByLabel('WebSocket Server URL').fill('ws://somewhere-else:1234');
    await page.getByRole('button', { name: 'Reset' }).click();

    await expect(page.getByText('Settings reset to defaults')).toBeVisible();
    await expect(page.getByLabel('WebSocket Server URL')).toHaveValue('ws://localhost:9222');
  });

  test('exports the settings as a JSON download', async ({ page }) => {
    await openApp(page, '/settings');

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^nats-ui-settings-.*\.json$/);
    await expect(page.getByText('Settings exported successfully')).toBeVisible();
  });
});
