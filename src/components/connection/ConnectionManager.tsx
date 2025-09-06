import { Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useNats } from '../../hooks/useNats';
import { toast } from 'sonner';
import { config as defaultConfig } from '../../config';

// Export for header status display
export function ConnectionStatus() {
  const { status, connect, disconnect, config } = useNats();

  const handleConnect = async () => {
    try {
      await connect({
        server: config.server || defaultConfig.nats.wsUrl,
        name: config.name || 'NATS UI Client',
        timeout: config.timeout || defaultConfig.nats.connectionTimeout,
      });
    } catch (err) {
      console.error('Connection failed:', err);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (err) {
      console.error('Disconnect failed:', err);
      toast.error('Failed to disconnect');
    }
  };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div className="flex items-center gap-2">
        {(status === 'disconnected' || status === 'error') && (
          <Button
            size="sm"
            onClick={handleConnect}
          >
            {status === 'error' ? 'Retry Connection' : 'Connect'}
          </Button>
        )}
        {status === 'connecting' && (
          <Button
            size="sm"
            disabled
            variant="outline"
          >
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Connecting...
          </Button>
        )}
        {status === 'connected' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleDisconnect}
          >
            Disconnect
          </Button>
        )}
      </div>
      
      {status === 'connecting' && (
        <div className="text-sm text-muted-foreground text-center">
          Connecting to {config.server}...
        </div>
      )}
      
      {status === 'connected' && (
        <div className="text-xs text-muted-foreground text-center">
          Connected to {config.server}
        </div>
      )}
    </div>
  );
}