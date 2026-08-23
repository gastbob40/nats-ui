import { describe, expect, it } from 'vitest';
import { createNatsService } from '@/services/nats-service';
import { NATS_TEST_CREDENTIALS, NATS_TEST_SERVERS } from '../support/nats-test-env';

describe('authenticated connections', () => {
  it('connects with valid user/password credentials', async () => {
    const service = await createNatsService([NATS_TEST_SERVERS.authUser.ws], {
      user: NATS_TEST_CREDENTIALS.user,
      pass: NATS_TEST_CREDENTIALS.pass,
    });

    await service.publish('auth.check', 'hello');
    await service.close();
  });

  it('rejects a wrong password', async () => {
    await expect(
      createNatsService([NATS_TEST_SERVERS.authUser.ws], {
        user: NATS_TEST_CREDENTIALS.user,
        pass: 'wrong-password',
      }),
    ).rejects.toThrow();
  });

  it('rejects a connection without credentials to a protected server', async () => {
    await expect(createNatsService([NATS_TEST_SERVERS.authUser.ws])).rejects.toThrow();
  });

  it('connects with a valid token', async () => {
    const service = await createNatsService([NATS_TEST_SERVERS.authToken.ws], {
      token: NATS_TEST_CREDENTIALS.token,
    });

    await service.publish('auth.check', 'hello');
    await service.close();
  });

  it('rejects a wrong token', async () => {
    await expect(
      createNatsService([NATS_TEST_SERVERS.authToken.ws], { token: 'wrong-token' }),
    ).rejects.toThrow();
  });
});
