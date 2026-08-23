import { createKVBucketRaw, deleteStreamRaw, expect, getStreamInfoRaw, openApp, putKVRaw, test, uniq } from './fixtures';

test.describe('kv store', () => {
  test('creates a bucket, then creates, edits and deletes a key', async ({ page, nc }) => {
    const bucket = uniq('E2EKV');
    await openApp(page, '/kv-store');

    // Create the bucket through the dialog.
    await page.getByRole('button', { name: 'Create Bucket' }).click();
    await page.getByLabel('Bucket Name').fill(bucket);
    await page.getByRole('dialog').getByRole('button', { name: 'Create Bucket' }).click();
    await expect(page.getByText(`Created bucket: ${bucket}`)).toBeVisible();
    await expect(page.getByTitle(`Delete bucket ${bucket}`)).toBeVisible();

    const info = await getStreamInfoRaw(nc, `KV_${bucket}`);
    expect((info.config as Record<string, unknown>).max_msgs_per_subject).toBe(1);

    // Create a key in that bucket.
    await page.getByRole('button', { name: 'Add Key-Value' }).click();
    await page.getByLabel('Bucket', { exact: true }).selectOption(bucket);
    await page.getByLabel('Key', { exact: true }).fill('color');
    await page.getByLabel('Value', { exact: true }).fill('blue');
    await page.getByRole('dialog').getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.getByText(`Created key: color in bucket: ${bucket}`)).toBeVisible();

    // Narrow the table to this test's key so rows from parallel tests can
    // never cover the action buttons.
    await page.getByPlaceholder('Search keys or values...').fill('color');
    const row = page.getByRole('row').filter({ hasText: bucket });
    await expect(row.getByText('color')).toBeVisible();
    await expect(row.getByText('blue')).toBeVisible();

    // Edit the value; the key is locked in edit mode.
    await row.getByTitle('Edit key').click();
    await expect(page.getByLabel('Key', { exact: true })).toBeDisabled();
    await page.getByLabel('Value', { exact: true }).fill('green');
    await page.getByRole('dialog').getByRole('button', { name: 'Update' }).click();
    await expect(page.getByText('Updated key: color')).toBeVisible();
    await expect(row.getByText('green')).toBeVisible();

    // Delete the key. The confirmation dialog stays open, close it explicitly.
    await row.getByTitle('Delete key').click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText('Deleted key: color')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(row).toBeHidden();

    // Delete the bucket.
    await page.getByTitle(`Delete bucket ${bucket}`).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.getByText(`Deleted bucket: ${bucket}`)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTitle(`Delete bucket ${bucket}`)).toBeHidden();

    const gone = await getStreamInfoRaw(nc, `KV_${bucket}`);
    expect(gone.error).toBeDefined();
  });

  test('filters keys by search term', async ({ page, nc }) => {
    const bucket = uniq('E2EKVSEARCH');
    await createKVBucketRaw(nc, bucket);
    await putKVRaw(nc, bucket, 'alpha_key', 'first value');
    await putKVRaw(nc, bucket, 'beta_key', 'second value');

    await openApp(page, '/kv-store');
    const rows = page.getByRole('row').filter({ hasText: bucket });
    await expect(rows).toHaveCount(2);

    await page.getByPlaceholder('Search keys or values...').fill('alpha_key');
    await expect(rows).toHaveCount(1);
    await expect(rows.getByText('alpha_key')).toBeVisible();

    await deleteStreamRaw(nc, `KV_${bucket}`);
  });
});
