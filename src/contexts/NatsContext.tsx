import { useEffect, useState, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { createNatsService } from '@/services/nats-service';
import { config } from '@/config';
import { NatsContext, type ConnectionConfig, type ConnectionStatus, type NatsContextType } from './nats-context';

const getStoredConfig = (): ConnectionConfig => {
  // Default configuration from config file
  const defaultConfig: ConnectionConfig = {
    server: config.nats.wsUrl,
    httpUrl: config.nats.httpUrl,
    timeout: config.nats.connectionTimeout,
  };

  try {
    const stored = localStorage.getItem('nats-ui-config');
    if (stored) {
      const parsedConfig = JSON.parse(stored);
      // Merge with defaults to ensure all required fields are present
      return {
        ...defaultConfig,
        ...parsedConfig,
      };
    }
  } catch (error) {
    console.error('Failed to load stored config:', error);
  }
  
  return defaultConfig;
};

interface NatsProviderProps {
  children: ReactNode;
}

export function NatsProvider({ children }: NatsProviderProps) {
  const [connection, setConnection] = useState<NatsContextType['connection']>(null);
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>(getStoredConfig);

  const connect = useCallback(async (config: ConnectionConfig) => {
    if (status === 'connecting' || status === 'connected') {
      return;
    }

    setStatus('connecting');
    setError(null);

    try {
      const service = await createNatsService([config.server]);

      setConnection(service);
      setStatus('connected');
      setConnectionConfig(config);
      
      // Store config for auto-reconnect
      try {
        localStorage.setItem('nats-ui-config', JSON.stringify(config));
      } catch (error) {
        console.error('Failed to store config:', error);
      }

      toast.success('Connected to NATS server');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
      setStatus('error');
      toast.error(`Failed to connect: ${errorMessage}`);
      throw error;
    }
  }, [status]);

  const disconnect = useCallback(async () => {
    if (connection && !connection.isClosed()) {
      await connection.close();
    }
    setConnection(null);
    setStatus('disconnected');
    setError(null);
    toast.info('Disconnected from NATS server');
  }, [connection]);

  const updateConfig = useCallback((newConfig: Partial<ConnectionConfig>) => {
    const updatedConfig = { ...connectionConfig, ...newConfig };
    
    // Update in memory
    setConnectionConfig(updatedConfig);
    
    // Store in localStorage
    try {
      localStorage.setItem('nats-ui-config', JSON.stringify(updatedConfig));
    } catch (error) {
      console.error('Failed to store updated config:', error);
    }
  }, [connectionConfig]);

  // Auto-connect functionality
  useEffect(() => {
    const autoConnect = async () => {
      if (status === 'disconnected' && connectionConfig.server) {
        try {
          await connect(connectionConfig);
        } catch {
          console.log('Auto-connect failed, waiting for manual connection');
        }
      }
    };

    autoConnect();
  }, [connect, connectionConfig, status]);

  const contextValue: NatsContextType = {
    connection,
    status,
    error,
    config: connectionConfig,
    connect,
    disconnect,
    updateConfig,
    isConnected: status === 'connected',
  };

  return (
    <NatsContext.Provider value={contextValue}>
      {children}
    </NatsContext.Provider>
  );
}