import { createDurableConsumer, createStreamRaw, deleteStreamRaw, expect, jsApiRequest, openApp, test, uniq } from './fixtures';

test.describe('consumers', () => {
  test('lists consumers with their stream and details', async ({ page, nc }) => {
    const stream = uniq('E2E_CONS');
    const consumer = uniq('worker');
    await createStreamRaw(nc, stream, [`${stream.toLowerCase()}.>`]);
    await createDurableConsumer(nc, stream, consumer);

    await openApp(page, '/consumers');
    const row = page.getByRole('row').filter({ hasText: consumer });
    await expect(row).toBeVisible();
    await expect(row.getByText(stream)).toBeVisible();

    await row.getByTitle('Consumer details').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(`Consumer: ${consumer}`)).toBeVisible();
    await expect(dialog.getByText('explicit')).toBeVisible();

    await deleteStreamRaw(nc, stream);
  });

  test('deletes a consumer after confirmation', async ({ page, nc }) => {
    const stream = uniq('E2E_CONSDEL');
    const consumer = uniq('goner');
    await createStreamRaw(nc, stream, [`${stream.toLowerCase()}.>`]);
    await createDurableConsumer(nc, stream, consumer);

    await openApp(page, '/consumers');
    const row = page.getByRole('row').filter({ hasText: consumer });
    await row.getByTitle('Delete consumer').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete Consumer' }).click();

    await expect(page.getByText(`Consumer ${consumer} deleted`)).toBeVisible();
    await expect(row).toBeHidden();

    const info = await jsApiRequest(nc, `$JS.API.CONSUMER.INFO.${stream}.${consumer}`);
    expect(info.error).toBeDefined();

    await deleteStreamRaw(nc, stream);
  });
});
