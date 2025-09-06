/**
 * Application configuration
 * 
 * Modify these values before building to customize your NATS UI deployment
 */
export const config = {
  nats: {
    // WebSocket URL for real-time NATS connections
    wsUrl: 'ws://localhost:9222',
    
    // HTTP URL for NATS monitoring API
    httpUrl: 'http://localhost:8222',
    
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