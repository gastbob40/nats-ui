/**
 * Application configuration
 *
 * Modify these values before building to customize your NATS UI deployment.
 * The NATS endpoints are an exception: they default to the host that served
 * the UI, so the same build works on any machine. Settings overrides (stored
 * in localStorage) always win over these defaults.
 */

// This is a pure browser app, so a baked-in `localhost` resolves on the
// viewer's machine instead of the host running NATS — the published image
// would only connect when the browser sits on the NATS box. Derive the host
// from wherever the page was loaded, since NATS normally runs beside the UI.
const pageLocation = typeof window !== 'undefined' ? window.location : undefined;
const natsHost = pageLocation?.hostname || 'localhost';

// A page served over https cannot open a ws:// socket or fetch http:// URLs,
// so mirror the page's scheme for TLS deployments.
const isSecure = pageLocation?.protocol === 'https:';

export const config = {
  nats: {
    // WebSocket URL for real-time NATS connections
    wsUrl: `${isSecure ? 'wss' : 'ws'}://${natsHost}:9222`,

    // HTTP URL for NATS monitoring API
    httpUrl: `${isSecure ? 'https' : 'http'}://${natsHost}:8222`,

    // Default connection timeout (milliseconds)
    connectionTimeout: 5000,
  },
  
  app: {
    // Application title displayed in browser tab
    title: 'NATS UI',
    
    // Maximum number of messages to keep in memory
    maxMessages: 1000,
    
    // Refresh interval for monitoring data (milliseconds)
    monitoringRefreshInterval: 5000,
  },
} as const;

export type Config = typeof config;