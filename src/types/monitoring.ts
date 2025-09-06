// NATS Monitoring types

export interface NatsServerInfo {
  server_id: string;
  version: string;
  go: string;
  host: string;
  port: number;
  auth_required?: boolean;
  ssl_required?: boolean;
  tls_required?: boolean;
  max_payload: number;
  proto: number;
  client_id?: number;
  client_ip?: string;
  subscriptions: number;
  connections: number;
  total_connections: number;
  routes: number;
  remotes: number;
  leafnodes: number;
  in_msgs: number;
  out_msgs: number;
  in_bytes: number;
  out_bytes: number;
  slow_consumers: number;
  uptime: string;
  now: string;
  jetstream?: boolean;
  max_connections?: number | string;
}

export interface NatsConnectionInfo {
  total: number;
  connections: Array<{
    cid: number;
    ip: string;
    port: number;
    start: string;
    last_activity: string;
    uptime: string;
    idle: string;
    pending_bytes: number;
    in_msgs: number;
    out_msgs: number;
    in_bytes: number;
    out_bytes: number;
    subscriptions: number;
    name?: string;
    lang?: string;
    version?: string;
  }>;
}

export interface JetStreamInfo {
  config?: {
    max_memory: number;
    max_storage: number;
    store_dir: string;
  };
  memory: number;
  storage: number;
  streams: number;
  consumers: number;
  messages: number;
  bytes: number;
  meta_cluster?: {
    name: string;
    leader: string;
    replicas: Array<{
      name: string;
      current: boolean;
      offline: boolean;
      active: number;
      lag: number;
    }>;
  };
}

export interface SubjectData {
  subject: string;
  messageCount: number;
  lastMessage: string;
  // Alternative formats for chart data
  name?: string;
  messages?: number;
  color?: string;
}

export interface TimeSeriesDataPoint {
  time: string;
  messages: number;
  bytes: number;
  connections: number;
  bytesIn?: number;
  bytesOut?: number;
  cpu?: number;
  memory?: number;
}