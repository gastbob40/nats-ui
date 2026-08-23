import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import { NatsProvider } from '@/contexts/NatsContext';
import { useNats } from '@/hooks/useNats';
import { createNatsService, setMonitoringUrl, type NatsService } from '@/services/nats-service';
import { config as appConfig } from '@/config';

vi.mock('@/services/nats-service', () => ({
  createNatsService: vi.fn(),
  setMonitoringUrl: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockedCreate = vi.mocked(createNatsService);

function makeService(): NatsService {
  let closed = false;
  return {
    publish: vi.fn(),
    subscribe: vi.fn(),
    close: vi.fn(async () => {
      closed = true;
    }),
    isClosed: vi.fn(() => closed),
    connection: {} as never,
    jetstream: {} as never,
  };
}

function Probe() {
  const nats = useNats();
  return (
    <div>
      <span data-testid="status">{nats.status}</span>
      <span data-testid="error">{nats.error ?? ''}</span>
      <span data-testid="server">{nats.config.server}</span>
      <button onClick={() => void nats.connect(nats.config).catch(() => {})}>connect</button>
      <button onClick={() => void nats.disconnect()}>disconnect</button>
      <button onClick={() => nats.updateConfig({ httpUrl: 'http://example.com:8222' })}>update</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <NatsProvider>
      <Probe />
    </NatsProvider>,
  );
}

async function waitForStatus(expected: string) {
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe(expected));
}

describe('NatsProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('auto-connects on mount with the default config', async () => {
    mockedCreate.mockResolvedValue(makeService());
    renderProvider();

    await waitForStatus('connected');
    expect(mockedCreate).toHaveBeenCalledWith([appConfig.nats.wsUrl], {
      user: undefined,
      pass: undefined,
      token: undefined,
    });
    expect(setMonitoringUrl).toHaveBeenCalledWith(appConfig.nats.httpUrl);
    expect(toast.success).toHaveBeenCalledWith('Connected to NATS server');
    expect(JSON.parse(localStorage.getItem('nats-ui-config') ?? '{}').server).toBe(appConfig.nats.wsUrl);
  });

  it('prefers the config stored in localStorage', async () => {
    localStorage.setItem(
      'nats-ui-config',
      JSON.stringify({ server: 'ws://stored:9222', user: 'alice', pass: 'secret' }),
    );
    mockedCreate.mockResolvedValue(makeService());
    renderProvider();

    await waitForStatus('connected');
    expect(mockedCreate).toHaveBeenCalledWith(['ws://stored:9222'], {
      user: 'alice',
      pass: 'secret',
      token: undefined,
    });
    // Missing fields are merged back from the defaults.
    expect(setMonitoringUrl).toHaveBeenCalledWith(appConfig.nats.httpUrl);
  });

  it('falls back to defaults when the stored config is corrupt', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    localStorage.setItem('nats-ui-config', '{broken');
    mockedCreate.mockResolvedValue(makeService());
    renderProvider();

    await waitForStatus('connected');
    expect(screen.getByTestId('server').textContent).toBe(appConfig.nats.wsUrl);
  });

  it('reports a failed connection with the attempted URL and reason', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedCreate.mockRejectedValue(new Error('boom'));
    renderProvider();

    await waitForStatus('error');
    expect(screen.getByTestId('error').textContent).toBe(`${appConfig.nats.wsUrl} — boom`);
    expect(toast.error).toHaveBeenCalledWith(`Failed to connect to ${appConfig.nats.wsUrl}`, {
      description: 'boom',
    });
  });

  it('explains empty connection errors in plain words', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedCreate.mockRejectedValue(new Error(''));
    renderProvider();

    await waitForStatus('error');
    expect(screen.getByTestId('error').textContent).toContain('no WebSocket server answered');
  });

  it('passes through string rejections as the reason', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedCreate.mockRejectedValue('network down');
    renderProvider();

    await waitForStatus('error');
    expect(screen.getByTestId('error').textContent).toContain('network down');
  });

  it('ignores connect calls while already connected', async () => {
    mockedCreate.mockResolvedValue(makeService());
    renderProvider();
    await waitForStatus('connected');

    screen.getByText('connect').click();
    await waitForStatus('connected');
    expect(mockedCreate).toHaveBeenCalledTimes(1);
  });

  it('disconnects, then the auto-connect effect reconnects', async () => {
    const service = makeService();
    mockedCreate.mockResolvedValue(service);
    renderProvider();
    await waitForStatus('connected');

    screen.getByText('disconnect').click();
    await waitFor(() => expect(service.close).toHaveBeenCalled());
    expect(toast.info).toHaveBeenCalledWith('Disconnected from NATS server');

    // Current behavior: a valid stored config makes the provider reconnect
    // immediately after a manual disconnect.
    await waitForStatus('connected');
    expect(mockedCreate).toHaveBeenCalledTimes(2);
  });

  it('still connects and updates config when localStorage writes fail', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    mockedCreate.mockResolvedValue(makeService());
    renderProvider();

    await waitForStatus('connected');

    screen.getByText('update').click();
    await waitFor(() => expect(setMonitoringUrl).toHaveBeenCalledWith('http://example.com:8222'));
    vi.mocked(localStorage.setItem).mockRestore();
  });

  it('updateConfig persists and re-targets the monitoring API', async () => {
    mockedCreate.mockResolvedValue(makeService());
    renderProvider();
    await waitForStatus('connected');

    screen.getByText('update').click();
    await waitFor(() => expect(setMonitoringUrl).toHaveBeenCalledWith('http://example.com:8222'));
    expect(JSON.parse(localStorage.getItem('nats-ui-config') ?? '{}').httpUrl).toBe('http://example.com:8222');
  });
});
