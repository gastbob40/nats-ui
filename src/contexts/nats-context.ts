import { createContext } from 'react';
import type { NatsService } from '@/services/nats-service';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ConnectionConfig {
  server: string;
  httpUrl?: string;
  name?: string;
  user?: string;
  pass?: string;
  token?: string;
  timeout?: number;
}

export interface NatsContextType {
  connection: NatsService | null;
  status: ConnectionStatus;
  error: string | null;
  config: ConnectionConfig;
  connect: (config: ConnectionConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  updateConfig: (config: Partial<ConnectionConfig>) => void;
  isConnected: boolean;
}

export const NatsContext = createContext<NatsContextType | undefined>(undefined);