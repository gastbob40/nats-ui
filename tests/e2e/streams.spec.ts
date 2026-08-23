import { createStreamRaw, deleteStreamRaw, expect, getStreamInfoRaw, openApp, test, uniq } from './fixtures';

test.describe('streams', () => {
  test('creates a stream through the dialog and verifies it server-side', async ({ page, nc }) => {
    const name = uniq('E2E_CREATE');
    await openApp(page, '/streams');

    await page.getByRole('button', { name: 'Create Stream' }).first().click();
    await page.getByLabel('Stream Name').fill(name);
    await page.getByLabel('Subjects (comma-separated)').fill(`${name.toLowerCase()}.>`);
    await page.getByRole('dialog').getByRole('button', { name: 'Create Stream' }).click();

    await expect(page.getByText(`Stream ${name} created successfully`)).toBeVisible();
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText('file')).toBeVisible();

    const info = await getStreamInfoRaw(nc, name);
    expect((info.config as Record<string, unknown>).name).toBe(name);

    await deleteStreamRaw(nc, name);
  });

  test('rejects an invalid stream name', async ({ page }) => {
    await openApp(page, '/streams');

    await page.getByRole('button', { name: 'Create Stream' }).first().click();
    await page.getByLabel('Stream Name').fill('invalid name!');
    await page.getByLabel('Subjects (comma-separated)').fill('some.subject');
    await page.getByRole('dialog').getByRole('button', { name: 'Create Stream' }).click();

    await expect(page.getByText('Invalid stream name')).toBeVisible();
  });

  test('surfaces a name conflict from the server', async ({ page, nc }) => {
    const name = uniq('E2E_DUP');
    await createStreamRaw(nc, name, [`${name.toLowerCase()}.orig`]);

    await openApp(page, '/streams');
    await page.getByRole('button', { name: 'Create Stream' }).first().click();
    await page.getByLabel('Stream Name').fill(name);
    await page.getByLabel('Subjects (comma-separated)').fill(`${name.toLowerCase()}.other`);
    await page.getByRole('dialog').getByRole('button', { name: 'Create Stream' }).click();

    await expect(page.getByText(`Stream "${name}" already exists`)).toBeVisible();

    await deleteStreamRaw(nc, name);
  });

  test('lists streams created outside the UI with their state', async ({ page, nc }) => {
    const name = uniq('E2E_LIST');
    const subject = `${name.toLowerCase()}.events`;
    await createStreamRaw(nc, name, [subject]);
    nc.publish(subject, 'one');
    nc.publish(subject, 'two');
    nc.publish(subject, 'three');
    await nc.flush();

    await openApp(page, '/streams');
    const row = page.getByRole('row').filter({ hasText: name });
    await expect(row).toBeVisible();
    await expect(row.getByText(subject)).toBeVisible();
    await expect(row.getByRole('cell', { name: '3', exact: true })).toBeVisible();
    await expect(row.getByText('memory')).toBeVisible();

    await deleteStreamRaw(nc, name);
  });

  test('shows stream details in a dialog', async ({ page, nc }) => {
    const name = uniq('E2E_DETAIL');
    await createStreamRaw(nc, name, [`${name.toLowerCase()}.>`], {
      description: 'stream for the details dialog test',
    });

    await openApp(page, '/streams');
    const row = page.getByRole('row').filter({ hasText: name });
    await row.getByTitle('Stream details').click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(`Stream: ${name}`)).toBeVisible();
    await expect(dialog.getByText(`${name.toLowerCase()}.>`)).toBeVisible();
    await expect(dialog.getByText('stream for the details dialog test')).toBeVisible();
    await expect(dialog.getByText('limits', { exact: true })).toBeVisible();

    await deleteStreamRaw(nc, name);
  });

  test('deletes a stream after confirmation', async ({ page, nc }) => {
    const name = uniq('E2E_DELETE');
    await createStreamRaw(nc, name, [`${name.toLowerCase()}.>`]);

    await openApp(page, '/streams');
    const row = page.getByRole('row').filter({ hasText: name });
    await row.getByTitle('Delete stream').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete Stream' }).click();

    await expect(page.getByText(`Stream ${name} deleted`)).toBeVisible();
    await expect(row).toBeHidden();

    const info = await getStreamInfoRaw(nc, name);
    expect(info.error).toBeDefined();
  });
});
