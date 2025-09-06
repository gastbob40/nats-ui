import { useContext } from 'react';
import { NatsContext, type NatsContextType } from '../contexts/nats-context';

export function useNats(): NatsContextType {
  const context = useContext(NatsContext);
  if (!context) {
    throw new Error('useNats must be used within a NatsProvider');
  }
  return context;
}