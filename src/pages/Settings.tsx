import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Server,
  Shield,
  Download,
  Upload,
  RotateCcw,
  Bug,
  Wifi,
  WifiOff,
  AlertCircle,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Badge } from '../components/ui/badge';
import { useNats } from '../hooks/useNats';
import { toast } from 'sonner';
import { config as defaultConfig } from '../config';

const connectionSchema = z.object({
  server: z.string().min(1, 'Server URL is required'),
  httpUrl: z.string().optional(),
  name: z.string().optional(),
  user: z.string().optional(),
  password: z.string().optional(),
  token: z.string().optional(),
  timeout: z.number().min(1000).max(60000),
  reconnectWait: z.number().min(100).max(30000),
  maxReconnectAttempts: z.number().min(-1).max(100),
});

type ConnectionFormData = z.infer<typeof connectionSchema>;

export function Settings() {
  const { config, updateConfig, status, error } = useNats();
  const [httpStatus, setHttpStatus] = useState<'checking' | 'available' | 'error' | 'unconfigured'>('unconfigured');
  const [httpError, setHttpError] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    notifications: {
      connectionEvents: true,
      errorAlerts: true,
      performanceWarnings: false,
    },
    display: {
      theme: 'system',
      compactMode: false,
      showTimestamps: true,
      autoRefresh: true,
      refreshInterval: 5000,
    },
    advanced: {
      debug: false,
      maxLogEntries: 1000,
      retainHistory: true,
      exportFormat: 'json',
    },
  });

  const checkHttpStatus = useCallback(async (httpUrl: string) => {
    if (!httpUrl) {
      setHttpStatus('unconfigured');
      setHttpError(null);
      return;
    }

    setHttpStatus('checking');
    setHttpError(null);

    try {
      // Test the HTTP endpoint (usually /varz for NATS monitoring)
      const testUrl = httpUrl.endsWith('/') ? `${httpUrl}varz` : `${httpUrl}/varz`;
      const response = await fetch(testUrl, {
        method: 'GET',
      });

      if (response.ok) {
        setHttpStatus('available');
      } else {
        setHttpStatus('error');
        setHttpError(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setHttpStatus('error');
      setHttpError(err instanceof Error ? err.message : 'Connection failed');
    }
  }, []);

  useEffect(() => {
    if (config.httpUrl) {
      checkHttpStatus(config.httpUrl);
    } else {
      setHttpStatus('unconfigured');
      setHttpError(null);
    }
  }, [config.httpUrl, checkHttpStatus]);

  const form = useForm<ConnectionFormData>({
    resolver: zodResolver(connectionSchema),
    defaultValues: {
      server: config.server || '',
      httpUrl: config.httpUrl || '',
      name: config.name || '',
      user: config.user || '',
      password: config.pass || '',
      token: config.token || '',
      timeout: config.timeout || 5000,
      reconnectWait: 2000,
      maxReconnectAttempts: 10,
    },
  });

  const handleSaveConnection = useCallback(async (data: ConnectionFormData) => {
    try {
      const newConfig = {
        server: data.server.trim(),
        httpUrl: data.httpUrl || undefined,
        name: data.name || 'NATS UI Client',
        user: data.user || undefined,
        pass: data.password || undefined,
        token: data.token || undefined,
        timeout: data.timeout,
      };

      updateConfig(newConfig);
      toast.success('Connection settings saved');
    } catch (err) {
      console.error('Save settings error:', err);
      toast.error('Failed to save connection settings');
    }
  }, [updateConfig]);

  const handleExportSettings = useCallback(() => {
    const exportData = {
      connection: config,
      settings,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nats-ui-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Settings exported successfully');
  }, [config, settings]);

  const handleImportSettings = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        
        if (imported.connection) {
          form.reset(imported.connection);
        }
        if (imported.settings) {
          setSettings(imported.settings);
        }
        
        toast.success('Settings imported successfully');
      } catch {
        toast.error('Failed to import settings - invalid file format');
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    event.target.value = '';
  }, [form]);

  const handleResetSettings = useCallback(() => {
    form.reset({
      server: defaultConfig.nats.wsUrl,
      httpUrl: defaultConfig.nats.httpUrl,
      name: 'NATS UI Client',
      user: '',
      password: '',
      token: '',
      timeout: defaultConfig.nats.connectionTimeout,
      reconnectWait: 2000,
      maxReconnectAttempts: 10,
    });

    setSettings({
      notifications: {
        connectionEvents: true,
        errorAlerts: true,
        performanceWarnings: false,
      },
      display: {
        theme: 'system',
        compactMode: false,
        showTimestamps: true,
        autoRefresh: true,
        refreshInterval: 5000,
      },
      advanced: {
        debug: false,
        maxLogEntries: 1000,
        retainHistory: true,
        exportFormat: 'json',
      },
    });

    toast.success('Settings reset to defaults');
  }, [form]);

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure your NATS UI application preferences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportSettings}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => document.getElementById('import-settings')?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <input
              id="import-settings"
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportSettings}
            />
            <Button variant="outline" size="sm" onClick={handleResetSettings}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
          </div>
        </div>
      </div>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    NATS Server Connection
                </CardTitle>
                <CardDescription>
                    Configure how to connect to your NATS server
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={form.handleSubmit(handleSaveConnection)} className="space-y-6">
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="server">WebSocket Server URL</Label>
                                <Input
                                    id="server"
                                    placeholder="ws://localhost:9222"
                                    autoComplete="off"
                                    data-form-type="other"
                                    {...form.register('server')}
                                />
                                <p className="text-sm text-muted-foreground">
                                    WebSocket URL for real-time NATS connections
                                </p>
                                {form.formState.errors.server && (
                                    <p className="text-sm text-red-600">
                                        {form.formState.errors.server.message}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="httpUrl">HTTP Monitoring URL</Label>
                                <Input
                                    id="httpUrl"
                                    placeholder="http://localhost:8222"
                                    autoComplete="off"
                                    data-form-type="other"
                                    {...form.register('httpUrl')}
                                />
                                <p className="text-sm text-muted-foreground">
                                    For monitoring API (optional)
                                </p>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="name">Client Name</Label>
                                <Input
                                    id="name"
                                    placeholder="NATS UI Client"
                                    autoComplete="off"
                                    data-form-type="other"
                                    {...form.register('name')}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="timeout">Connection Timeout (ms)</Label>
                                <Input
                                    id="timeout"
                                    type="number"
                                    min="1000"
                                    max="60000"
                                    autoComplete="off"
                                    data-form-type="other"
                                    {...form.register('timeout', { valueAsNumber: true })}
                                />
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h4 className="text-sm font-medium flex items-center gap-2">
                            <Shield className="h-4 w-4" />
                            Authentication (Optional)
                        </h4>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="user">Username</Label>
                                <Input
                                    id="user"
                                    type="text"
                                    autoComplete="off"
                                    data-form-type="other"
                                    {...form.register('user')}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    autoComplete="new-password"
                                    data-form-type="other"
                                    {...form.register('password')}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="token">Token (alternative to username/password)</Label>
                            <Input
                                id="token"
                                type="password"
                                placeholder="JWT token or auth token"
                                autoComplete="off"
                                data-form-type="other"
                                {...form.register('token')}
                            />
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <h4 className="text-sm font-medium">Reconnection Settings</h4>

                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="reconnectWait">Reconnect Wait (ms)</Label>
                                <Input
                                    id="reconnectWait"
                                    type="number"
                                    min="100"
                                    max="30000"
                                    autoComplete="off"
                                    data-form-type="other"
                                    {...form.register('reconnectWait', { valueAsNumber: true })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="maxReconnectAttempts">Max Reconnect Attempts</Label>
                                <Input
                                    id="maxReconnectAttempts"
                                    type="number"
                                    min="-1"
                                    max="100"
                                    placeholder="-1 for unlimited"
                                    autoComplete="off"
                                    data-form-type="other"
                                    {...form.register('maxReconnectAttempts', { valueAsNumber: true })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            type="submit"
                            disabled={form.formState.isSubmitting}
                        >
                            Save Connection Settings
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Bug className="h-5 w-5" />
                    Connection Debug
                </CardTitle>
                <CardDescription>
                    Detailed connection status and troubleshooting information
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold">Connection Status</h4>
                    
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-3">
                            {status === 'connected' ? (
                                <Wifi className="h-4 w-4 text-green-600" />
                            ) : status === 'connecting' ? (
                                <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full" />
                            ) : status === 'error' ? (
                                <AlertCircle className="h-4 w-4 text-red-600" />
                            ) : (
                                <WifiOff className="h-4 w-4 text-gray-400" />
                            )}
                            <span className="text-sm font-medium">Overall Status:</span>
                        </div>
                        <Badge 
                            variant={status === 'connected' ? 'default' : status === 'error' ? 'destructive' : 'secondary'}
                            className={status === 'connected' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''}
                        >
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                        </Badge>
                    </div>

                    <div className="grid gap-3">
                        <div className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                                <div className={`w-2 h-2 rounded-full ${
                                    status === 'connected' ? 'bg-green-500' : 
                                    status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
                                    status === 'error' ? 'bg-red-500' : 'bg-gray-400'
                                }`}></div>
                                <span className="text-sm font-medium">WebSocket Server</span>
                                {status === 'connecting' && (
                                    <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full" />
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-sm text-muted-foreground">{config.server || 'Not configured'}</div>
                                <Badge 
                                    variant={
                                        status === 'connected' ? 'default' : 
                                        status === 'error' ? 'destructive' : 
                                        'secondary'
                                    }
                                    className={`text-xs mt-1 ${
                                        status === 'connected' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''
                                    }`}
                                >
                                    {status === 'connected' ? 'Connected' : 
                                     status === 'connecting' ? 'Connecting...' :
                                     status === 'error' ? 'Error' : 'Disconnected'}
                                </Badge>
                            </div>
                        </div>

                        {config.httpUrl ? (
                            <div className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${
                                        httpStatus === 'available' ? 'bg-green-500' : 
                                        httpStatus === 'error' ? 'bg-red-500' :
                                        httpStatus === 'checking' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-400'
                                    }`}></div>
                                    <span className="text-sm font-medium">HTTP Monitoring API</span>
                                    {httpStatus === 'checking' && (
                                        <div className="animate-spin h-3 w-3 border border-blue-600 border-t-transparent rounded-full" />
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-muted-foreground">{config.httpUrl}</div>
                                    <Badge 
                                        variant={
                                            httpStatus === 'available' ? 'default' : 
                                            httpStatus === 'error' ? 'destructive' : 
                                            'outline'
                                        }
                                        className={`text-xs mt-1 ${
                                            httpStatus === 'available' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''
                                        }`}
                                    >
                                        {httpStatus === 'available' ? 'Available' : 
                                         httpStatus === 'error' ? 'Error' :
                                         httpStatus === 'checking' ? 'Checking...' : 'Unknown'}
                                    </Badge>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center justify-between p-3 border rounded-lg opacity-60">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-gray-400"></div>
                                    <span className="text-sm font-medium">HTTP Monitoring API</span>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-muted-foreground">Not configured</div>
                                    <Badge variant="outline" className="text-xs mt-1">
                                        Optional
                                    </Badge>
                                </div>
                            </div>
                        )}
                    </div>

                    {(error || httpError) && (
                        <div className="space-y-2">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertCircle className="h-4 w-4 text-red-600" />
                                        <span className="text-sm font-medium text-red-800 dark:text-red-200">WebSocket Connection Error</span>
                                    </div>
                                    <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                                </div>
                            )}
                            {httpError && (
                                <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                                    <div className="flex items-center gap-2 mb-1">
                                        <AlertCircle className="h-4 w-4 text-orange-600" />
                                        <span className="text-sm font-medium text-orange-800 dark:text-orange-200">HTTP API Error</span>
                                    </div>
                                    <p className="text-sm text-orange-700 dark:text-orange-300">{httpError}</p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-2 border-t">
                        <h4 className="text-sm font-semibold mb-2">Configuration Details</h4>
                        <div className="grid gap-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Client Name:</span>
                                <span>{config.name || 'Default'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Connection Timeout:</span>
                                <span>{config.timeout || 5000}ms</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Authentication:</span>
                                <span>{config.user ? 'Username/Password' : config.token ? 'Token' : 'None'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}