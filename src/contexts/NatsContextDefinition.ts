import { createContext } from 'react';
import type { NatsService } from '@/services/nats-service';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionConfig {
  servers: string[];
  name?: string;
}

export interface NatsContextType {
  service: NatsService | null;
  status: ConnectionStatus;
  error: string | null;
  config: ConnectionConfig;
  isConnected: boolean;
  connect: (config: ConnectionConfig) => Promise<void>;
  disconnect: () => Promise<void>;
}

export const NatsContext = createContext<NatsContextType | undefined>(undefined);