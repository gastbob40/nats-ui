import { useEffect, useState, useCallback } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';
import {
  Activity,
  Database,
  MessageSquare,
  Users,
  TrendingUp,
  Server,
  Zap,
  Clock,
  AlertCircle,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ConnectionStatus } from '../components/connection/ConnectionManager';
import { useNats } from '../hooks/useNats';
import { fetchNatsInfo, fetchNatsConnections, fetchJetStreamInfo } from '../services/nats-service';
import { MetricCardSkeleton } from '../components/ui/skeletons';
import { staggerContainer, staggerItem, iconSpring, easings } from '../lib/animations';

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

function MetricCard({ title, value, description, icon, trend }: MetricCardProps) {
  // Animated counter for numeric values
  const isNumeric = typeof value === 'number';
  const numericValue = isNumeric ? value : 0;
  const springValue = useSpring(numericValue, { stiffness: 100, damping: 30 });
  const display = useTransform(springValue, (latest) => Math.floor(latest).toLocaleString());

  useEffect(() => {
    if (isNumeric) {
      springValue.set(numericValue);
    }
  }, [numericValue, springValue, isNumeric]);

  return (
    <motion.div
      variants={staggerItem}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -2, transition: { duration: 0.15, ease: easings.easeOut } }}
      style={{ cursor: 'default' }}
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <motion.div
            whileHover={{ scale: 1.15, rotate: 5 }}
            transition={iconSpring}
          >
            {icon}
          </motion.div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {isNumeric ? <motion.span>{display}</motion.span> : value}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          )}
          {trend && (
            <motion.div
              className="flex items-center mt-1"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <TrendingUp className={`h-4 w-4 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`} />
              <span className={`text-xs ml-1 ${trend.isPositive ? 'text-green-500' : 'text-red-500'}`}>
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function Dashboard() {
  const { isConnected, status, error, config } = useNats();
  const [serverInfo, setServerInfo] = useState<Record<string, unknown> | null>(null);
  const [connections, setConnections] = useState<Record<string, unknown> | null>(null);
  const [jetStreamInfo, setJetStreamInfo] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [uptimeOffset, setUptimeOffset] = useState<number>(0);
  const [lastFetchTime, setLastFetchTime] = useState<number>(Date.now());
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // Fetch real NATS metrics
  const fetchMetrics = useCallback(async () => {
    if (!isConnected) return;
    
    // Only show loading on initial load
    if (initialLoading) {
      setLoading(true);
    }
    
    try {
      const [info, conns, js] = await Promise.all([
        fetchNatsInfo(),
        fetchNatsConnections(), 
        fetchJetStreamInfo()
      ]);
      
      setServerInfo(info);
      setConnections(conns);
      setJetStreamInfo(js);
      
      // Update the uptime reference point
      if (info?.uptime && typeof info.uptime === 'string') {
        setUptimeOffset(parseUptimeToSeconds(info.uptime));
        setLastFetchTime(Date.now());
      }
      
      if (initialLoading) {
        setInitialLoading(false);
      }
    } catch (error) {
      console.error('Failed to fetch NATS metrics:', error);
    } finally {
      if (initialLoading) {
        setLoading(false);
      }
    }
  }, [isConnected, initialLoading]);

  useEffect(() => {
    fetchMetrics();
    
    // Refresh metrics every 5 seconds when connected
    if (isConnected) {
      const interval = setInterval(fetchMetrics, 5000);
      return () => clearInterval(interval);
    }
  }, [fetchMetrics, isConnected]);


  // Update current time every second for real-time uptime
  useEffect(() => {
    if (isConnected) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  function parseUptimeToSeconds(uptimeStr: string): number {
    if (!uptimeStr) return 0;
    
    let totalSeconds = 0;
    const dayMatch = uptimeStr.match(/(\d+)d/);
    const hourMatch = uptimeStr.match(/(\d+)h/);
    const minMatch = uptimeStr.match(/(\d+)m/);
    const secMatch = uptimeStr.match(/(\d+)s/);
    
    if (dayMatch) totalSeconds += parseInt(dayMatch[1]) * 86400;
    if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
    if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
    if (secMatch) totalSeconds += parseInt(secMatch[1]);
    
    return totalSeconds;
  }

  function formatUptimeFromSeconds(totalSeconds: number): string {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  // function formatUptime(uptimeStr: string): string {
  //   if (!uptimeStr) return '0s';
  //   
  //   // Parse format like "34m32s" or "1h30m45s" or "2d5h30m"
  //   let totalSeconds = 0;
  //   
  //   // Extract days (d), hours (h), minutes (m), seconds (s)
  //   const dayMatch = uptimeStr.match(/(\d+)d/);
  //   const hourMatch = uptimeStr.match(/(\d+)h/);
  //   const minMatch = uptimeStr.match(/(\d+)m/);
  //   const secMatch = uptimeStr.match(/(\d+)s/);
  //   
  //   if (dayMatch) totalSeconds += parseInt(dayMatch[1]) * 86400;
  //   if (hourMatch) totalSeconds += parseInt(hourMatch[1]) * 3600;
  //   if (minMatch) totalSeconds += parseInt(minMatch[1]) * 60;
  //   if (secMatch) totalSeconds += parseInt(secMatch[1]);
  //   
  //   // Format back to readable format
  //   const days = Math.floor(totalSeconds / 86400);
  //   const hours = Math.floor((totalSeconds % 86400) / 3600);
  //   const minutes = Math.floor((totalSeconds % 3600) / 60);
  //   const seconds = totalSeconds % 60;
  //   
  //   if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  //   if (hours > 0) return `${hours}h ${minutes}m`;
  //   if (minutes > 0) return `${minutes}m ${seconds}s`;
  //   return `${seconds}s`;
  // }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Calculate real-time uptime
  const getRealTimeUptime = (): string => {
    if (!uptimeOffset || !isConnected) return '0s';
    
    const elapsedSinceLastFetch = Math.floor((currentTime - lastFetchTime) / 1000);
    const currentUptimeSeconds = uptimeOffset + elapsedSinceLastFetch;
    
    return formatUptimeFromSeconds(currentUptimeSeconds);
  };

  // Calculate metrics from real data
  const metrics = {
    connections: Array.isArray((connections as Record<string, unknown>)?.connections) 
      ? ((connections as Record<string, unknown>).connections as unknown[]).length 
      : 0,
    subscriptions: typeof serverInfo?.subscriptions === 'number' ? serverInfo.subscriptions : 0,
    messages: typeof serverInfo?.in_msgs === 'number' ? serverInfo.in_msgs : 0,
    bytesIn: serverInfo && typeof serverInfo.in_bytes === 'number' 
      ? formatBytes(serverInfo.in_bytes) 
      : '0 B',
    bytesOut: serverInfo && typeof serverInfo.out_bytes === 'number' 
      ? formatBytes(serverInfo.out_bytes) 
      : '0 B',
    uptime: getRealTimeUptime(),
  };

  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-6 max-w-2xl mx-auto px-4">
          {status === 'error' ? (
            <AlertCircle className="h-16 w-16 mx-auto text-destructive" />
          ) : (
            <Server className="h-16 w-16 mx-auto text-muted-foreground" />
          )}
          
          <div>
            <h2 className="text-2xl font-semibold mb-3">
              {status === 'error' ? 'Connection Failed' : 'Not Connected'}
            </h2>
            
            {status === 'error' && error ? (
              <div className="space-y-4">
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-left">
                  <p className="text-sm text-destructive/80 font-mono break-words">{error}</p>
                </div>
                
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Common issues and solutions:</p>
                  <ul className="text-left space-y-1 max-w-md mx-auto">
                    <li>• Check if NATS server is running at <span className="font-mono">{config.server}</span></li>
                    <li>• Verify WebSocket support is enabled on the server</li>
                    <li>• Ensure the server port is accessible and not blocked by firewall</li>
                    <li>• Check if the server URL and port are correct in settings</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Connect to a NATS server to view the dashboard
                </p>
                
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>Common issues and solutions:</p>
                  <ul className="text-left space-y-1 max-w-md mx-auto">
                    <li>• Check if NATS server is running at <span className="font-mono">{config.server}</span></li>
                    <li>• Verify WebSocket support is enabled on the server</li>
                    <li>• Ensure the server port is accessible and not blocked by firewall</li>
                    <li>• Check if the server URL and port are correct in settings</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
          
          <div className="w-full max-w-sm mx-auto">
            <ConnectionStatus />
          </div>
          
          {status === 'error' && (
            <div className="text-xs text-muted-foreground">
              You can update the connection settings in the Settings page
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
      </div>

      {/* Connection Status */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <motion.div
                animate={status === 'connected' ? {
                  scale: [1, 1.08, 1],
                  transition: {
                    duration: 2,
                    repeat: Infinity,
                    ease: easings.standard
                  }
                } : {}}
              >
                <Activity className="h-5 w-5" />
              </motion.div>
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Server</p>
                <p className="text-lg font-semibold">{config.server}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Status</p>
                <motion.div
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  <Badge variant={status === 'connected' ? 'default' : 'destructive'}>
                    {status}
                  </Badge>
                </motion.div>
              </div>
            </div>
            {error && (
              <motion.div
                className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <p className="text-sm text-destructive">{error}</p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Metrics Grid */}
      <motion.div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        {initialLoading && loading ? (
          <>
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
            <MetricCardSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              title="Active Connections"
              value={metrics.connections}
              description="Current client connections"
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
            />
            <MetricCard
              title="Subscriptions"
              value={metrics.subscriptions}
              description="Total active subscriptions"
              icon={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
            />
            <MetricCard
              title="Messages Processed"
              value={metrics.messages}
              description="Total messages processed"
              icon={<Zap className="h-4 w-4 text-muted-foreground" />}
            />
            <MetricCard
              title="Uptime"
              value={metrics.uptime}
              description="Server uptime"
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            />
          </>
        )}
      </motion.div>

      {/* Data Transfer */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Data In
            </CardTitle>
            <CardDescription>
              Total data received by the server
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.bytesIn}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 rotate-180" />
              Data Out
            </CardTitle>
            <CardDescription>
              Total data sent by the server
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.bytesOut}</div>
          </CardContent>
        </Card>
      </div>

      {/* Server Information */}
      {serverInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Server Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Server ID</p>
                <p className="font-mono text-sm truncate" title={String(serverInfo.server_id || '')}>
                  {String(serverInfo.server_id || 'Unknown')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Version</p>
                <p className="font-mono text-sm">{String(serverInfo.version || 'Unknown')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Go Version</p>
                <p className="font-mono text-sm">{String(serverInfo.go || 'Unknown')}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">JetStream</p>
                <Badge variant={serverInfo.jetstream !== undefined ? 'default' : 'secondary'}>
                  {serverInfo.jetstream !== undefined ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* JetStream Information */}
      {jetStreamInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              JetStream
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-sm text-muted-foreground">Memory Usage</p>
                <p className="text-lg font-semibold">{formatBytes(typeof jetStreamInfo.memory === 'number' ? jetStreamInfo.memory : 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Storage Usage</p>
                <p className="text-lg font-semibold">{formatBytes(typeof jetStreamInfo.storage === 'number' ? jetStreamInfo.storage : 0)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">API Requests</p>
                <p className="text-lg font-semibold">{(() => {
                  if (jetStreamInfo.api && typeof jetStreamInfo.api === 'object' && jetStreamInfo.api !== null) {
                    const apiObj = jetStreamInfo.api as Record<string, unknown>;
                    return typeof apiObj.total === 'number' ? apiObj.total : 0;
                  }
                  return 0;
                })()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="text-center text-muted-foreground">
          <Activity className="h-4 w-4 animate-spin inline-block mr-2" />
          Refreshing metrics...
        </div>
      )}
    </div>
  );
}