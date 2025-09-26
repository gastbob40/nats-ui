import { connect, type NatsConnection, headers as createHeaders, type MsgHdrs } from 'nats.ws';
import { toast } from 'sonner';
import { subjectTracker } from './subject-tracker';
import { config } from '../config';

export interface NatsService {
  publish: (subject: string, data: unknown, headers?: Record<string, string>) => Promise<void>;
  subscribe: (subject: string, callback: (msg: { subject: string; data: unknown; headers?: Record<string, string>; timestamp: number; reply?: string }) => void) => Promise<() => void>;
  close: () => Promise<void>;
  isClosed: () => boolean;
  connection: NatsConnection;
  jetstream: JetStreamManager;
}

class RealNatsService implements NatsService {
  private readonly subscriptions = new Map<string, () => void>();
  public readonly jetstream: JetStreamManager;
  public readonly connection: NatsConnection;

  constructor(connection: NatsConnection) {
    this.connection = connection;
    this.jetstream = new JetStreamManager(connection);
  }

  async publish(subject: string, data: unknown, msgHeaders?: Record<string, string>): Promise<void> {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    const encodedData = new TextEncoder().encode(payload);

    try {
      // Create headers if provided
      const options: { headers?: MsgHdrs } = {};
      if (msgHeaders && Object.keys(msgHeaders).length > 0) {
        const h = createHeaders();
        for (const [key, value] of Object.entries(msgHeaders)) {
          h.append(key, value);
        }
        options.headers = h;
      }

      // Publish the message - this is synchronous but can throw
      this.connection.publish(subject, encodedData, options);

      // Track published subject after successful publish
      subjectTracker.track(subject, payload);
    } catch (error) {
      console.error(`Failed to publish to subject ${subject}:`, error);
      throw error;
    }
  }

  async subscribe(subject: string, callback: (msg: { subject: string; data: unknown; headers?: Record<string, string>; timestamp: number; reply?: string }) => void): Promise<() => void> {
    const sub = this.connection.subscribe(subject);
    
    // Process messages in background
    (async () => {
      for await (const msg of sub) {
        try {
          const data = new TextDecoder().decode(msg.data);
          let parsedData: unknown;
          
          try {
            parsedData = JSON.parse(data);
          } catch {
            parsedData = data;
          }

          // Track received subject
          subjectTracker.track(msg.subject, typeof parsedData === 'string' ? parsedData : JSON.stringify(parsedData));

          // Extract headers if present
          let headers: Record<string, string> | undefined;
          if (msg.headers) {
            headers = {};
            // Convert Headers iterator to plain object
            for (const [key, values] of msg.headers) {
              headers[key] = Array.isArray(values) ? values[0] : values;
            }
          }

          callback({
            subject: msg.subject,
            data: parsedData,
            timestamp: Date.now(),
            reply: msg.reply,
            headers
          });
        } catch (error) {
          console.error('Error processing message:', error);
        }
      }
    })();

    const unsubscribe = () => {
      sub.unsubscribe();
      this.subscriptions.delete(subject);
    };

    this.subscriptions.set(subject, unsubscribe);
    return unsubscribe;
  }

  async close(): Promise<void> {
    // Unsubscribe from all subscriptions
    for (const unsubscribe of this.subscriptions.values()) {
      unsubscribe();
    }
    this.subscriptions.clear();
    
    await this.connection.close();
  }

  isClosed(): boolean {
    return this.connection.isClosed();
  }
}

export async function createNatsService(servers: string[]): Promise<NatsService> {
  try {
    const connection = await connect({
      servers,
      timeout: 10000,
      name: 'NATS UI Client',
    });
    return new RealNatsService(connection);
    
  } catch (error) {
    console.error('Failed to connect to NATS server:', error);
    toast.error(`Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

// Utility functions for NATS monitoring API
export async function fetchNatsInfo(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${config.nats.httpUrl}/varz`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Could not fetch NATS info:', error);
    return null;
  }
}

export async function fetchNatsConnections(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${config.nats.httpUrl}/connz`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Could not fetch NATS connections:', error);
    return null;
  }
}

export async function fetchJetStreamInfo(): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${config.nats.httpUrl}/jsz`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.warn('Could not fetch JetStream info:', error);
    return null;
  }
}

export async function fetchActiveSubjects(): Promise<string[]> {
  try {
    const response = await fetch(`${config.nats.httpUrl}/connz?subs=1`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // Collect all unique subjects from all connections
    const subjects = new Set<string>();
    
    if (Array.isArray(data.connections)) {
      data.connections.forEach((conn: Record<string, unknown>) => {
        if (Array.isArray(conn.subscriptions_list)) {
          conn.subscriptions_list.forEach((sub: string) => subjects.add(sub));
        }
      });
    }
    
    return Array.from(subjects).sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.warn('Could not fetch active subjects:', error);
    return [];
  }
}

// JetStream Stream Management Functions
export async function fetchJetStreamStreams(): Promise<Record<string, unknown>[]> {
  try {
    const response = await fetch(`${config.nats.httpUrl}/jsz?streams=1`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    return data.streams || [];
  } catch (error) {
    console.warn('Could not fetch JetStream streams:', error);
    return [];
  }
}

export async function fetchJetStreamStreamInfo(streamName: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${config.nats.httpUrl}/jsz?stream=${streamName}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    return data.stream_detail || null;
  } catch (error) {
    console.warn(`Could not fetch stream info for ${streamName}:`, error);
    return null;
  }
}

// JetStream Stream Management via NATS Connection
export class JetStreamManager {
  private readonly connection: NatsConnection;
  
  constructor(connection: NatsConnection) {
    this.connection = connection;
  }

  async createStream(config: {
    name: string;
    subjects: string[];
    description?: string;
    retention: 'limits' | 'interest' | 'workqueue';
    storage: 'file' | 'memory';
    maxMsgs: number;
    maxBytes: number;
    maxAge: number;
    replicas: number;
  }): Promise<Record<string, unknown>> {
    try {
      // Convert to JetStream API format
      const streamConfig = {
        name: config.name,
        subjects: config.subjects,
        description: config.description,
        retention: config.retention,
        storage: config.storage,
        max_msgs: config.maxMsgs,
        max_bytes: config.maxBytes,
        max_age: config.maxAge * 1000000000, // Convert to nanoseconds
        num_replicas: config.replicas,
      };

      const response = await this.connection.request(
        '$JS.API.STREAM.CREATE.' + config.name,
        JSON.stringify(streamConfig),
        { timeout: 5000 }
      );

      const result = JSON.parse(new TextDecoder().decode(response.data));
      
      if (result.error) {
        throw new Error(`JetStream API error: ${result.error.description || result.error.message || 'Unknown error'}`);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to create stream:', error);
      throw error;
    }
  }

  async deleteStream(streamName: string): Promise<void> {
    try {
      await this.connection.request(
        '$JS.API.STREAM.DELETE.' + streamName,
        JSON.stringify({}),
        { timeout: 5000 }
      );
    } catch (error) {
      console.error('Failed to delete stream:', error);
      throw error;
    }
  }

  async listStreams(): Promise<Record<string, unknown>[]> {
    try {
      const response = await this.connection.request(
        '$JS.API.STREAM.LIST',
        JSON.stringify({}),
        { timeout: 5000 }
      );

      const result = JSON.parse(new TextDecoder().decode(response.data));
      
      if (result.error) {
        console.error('JetStream API error:', result.error);
        return [];
      }
      
      return result.streams || [];
    } catch (error) {
      console.error('Failed to list streams:', error);
      return [];
    }
  }

  async getStreamInfo(streamName: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.connection.request(
        '$JS.API.STREAM.INFO.' + streamName,
        JSON.stringify({}),
        { timeout: 5000 }
      );

      return JSON.parse(new TextDecoder().decode(response.data));
    } catch (error) {
      console.error('Failed to get stream info:', error);
      return null;
    }
  }

  // Consumer Management
  async listConsumers(streamName: string): Promise<Record<string, unknown>[]> {
    try {
      const response = await this.connection.request(
        `$JS.API.CONSUMER.LIST.${streamName}`,
        JSON.stringify({}),
        { timeout: 5000 }
      );

      const result = JSON.parse(new TextDecoder().decode(response.data));
      return result.consumers || [];
    } catch (error) {
      console.error('Failed to list consumers:', error);
      return [];
    }
  }

  async getConsumerInfo(streamName: string, consumerName: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await this.connection.request(
        `$JS.API.CONSUMER.INFO.${streamName}.${consumerName}`,
        JSON.stringify({}),
        { timeout: 5000 }
      );

      return JSON.parse(new TextDecoder().decode(response.data));
    } catch (error) {
      console.error('Failed to get consumer info:', error);
      return null;
    }
  }

  async deleteConsumer(streamName: string, consumerName: string): Promise<void> {
    try {
      await this.connection.request(
        `$JS.API.CONSUMER.DELETE.${streamName}.${consumerName}`,
        JSON.stringify({}),
        { timeout: 5000 }
      );
    } catch (error) {
      console.error('Failed to delete consumer:', error);
      throw error;
    }
  }

  // KV Store Management
  async listKVBuckets(): Promise<string[]> {
    try {
      // KV stores are implemented as streams with specific naming pattern
      const streams = await this.listStreams();
      return streams
        .filter((stream) => {
          const config = stream.config as Record<string, unknown> | undefined;
          const name = config?.name;
          return typeof name === 'string' && name.startsWith('KV_');
        })
        .map((stream) => {
          const config = stream.config as Record<string, unknown>;
          const name = config.name as string;
          return name.replace('KV_', '');
        });
    } catch (error) {
      console.error('Failed to list KV buckets:', error);
      return [];
    }
  }

  async createKVBucket(name: string, ttl?: number): Promise<void> {
    try {
      const maxAge = ttl ? ttl * 1000000000 : 0; // Convert to nanoseconds
      const duplicateWindow = maxAge > 0 ? Math.min(120000000000, maxAge) : 120000000000; // 2 minutes max or less than max_age
      
      const config = {
        name: `KV_${name}`,
        subjects: [`$KV.${name}.>`],
        retention: 'limits' as const,
        storage: 'file' as const,
        max_msgs: -1,
        max_bytes: -1,
        max_age: maxAge,
        max_msg_size: -1,
        num_replicas: 1,
        discard: 'new',
        duplicate_window: maxAge > 0 ? duplicateWindow : 0, // Set to 0 when no max_age
        allow_rollup_hdrs: true,
        deny_delete: false,
        // KV-specific configuration
        max_msgs_per_subject: 1, // Only keep latest value per key
        allow_direct: true, // Allow direct access
      };

      const response = await this.connection.request(
        `$JS.API.STREAM.CREATE.KV_${name}`,
        JSON.stringify(config),
        { timeout: 5000 }
      );

      const result = JSON.parse(new TextDecoder().decode(response.data));
      if (result.error) {
        throw new Error(`JetStream API error: ${result.error.description}`);
      }
      
    } catch (error) {
      console.error('Failed to create KV bucket:', error);
      throw error;
    }
  }

  async deleteKVBucket(name: string): Promise<void> {
    try {
      await this.deleteStream(`KV_${name}`);
    } catch (error) {
      console.error('Failed to delete KV bucket:', error);
      throw error;
    }
  }

  async getKVKeys(bucket: string): Promise<string[]> {
    try {
      // Get stream info first to check if it exists
      const streamInfo = await this.getStreamInfo(`KV_${bucket}`);
      if (!streamInfo || !streamInfo.state) {
        console.warn(`KV bucket ${bucket} not found`);
        return [];
      }

      const state = streamInfo.state as Record<string, unknown>;
      const messageCount = state.messages as number;
      
      if (messageCount === 0) {
        return [];
      }

      // Get messages from the stream to find subjects (keys)
      const keys = new Set<string>();
      
      // Use first_seq and last_seq to get the actual range
      const firstSeq = state.first_seq as number;
      const lastSeq = state.last_seq as number;
      
      // Fetch messages in the actual sequence range
      for (let seq = firstSeq; seq <= lastSeq; seq++) {
        try {
          const response = await this.connection.request(
            `$JS.API.STREAM.MSG.GET.KV_${bucket}`,
            JSON.stringify({ seq }),
            { timeout: 2000 }
          );

          const result = JSON.parse(new TextDecoder().decode(response.data));
          
          if (result.message?.subject) {
            const subject = result.message.subject as string;
            if (subject.startsWith(`$KV.${bucket}.`)) {
              const key = subject.replace(`$KV.${bucket}.`, '');
              if (key) {
                keys.add(key);
              }
            }
          }
        } catch {
          // Message might not exist at this sequence, continue
          continue;
        }
      }

      return Array.from(keys);
    } catch (error) {
      console.error('Failed to get KV keys:', error);
      return [];
    }
  }

  async getKVValue(bucket: string, key: string): Promise<string | null> {
    try {
      const response = await this.connection.request(
        `$JS.API.STREAM.MSG.GET.KV_${bucket}`,
        JSON.stringify({ last_by_subj: `$KV.${bucket}.${key}` }),
        { timeout: 5000 }
      );

      const result = JSON.parse(new TextDecoder().decode(response.data));
      if (result.message?.data) {
        return atob(result.message.data);
      }
      return null;
    } catch (error) {
      console.error('Failed to get KV value:', error);
      return null;
    }
  }

  async putKVValue(bucket: string, key: string, value: string): Promise<void> {
    try {
      // Publish directly to the KV subject with proper headers
      const headers = createHeaders();
      headers.set('Nats-Msg-Id', `${bucket}-${key}-${Date.now()}`);
      
      this.connection.publish(
        `$KV.${bucket}.${key}`,
        new TextEncoder().encode(value),
        { headers }
      );
      
      // Small delay to ensure the message is processed
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Failed to put KV value:', error);
      throw error;
    }
  }

  async deleteKVKey(bucket: string, key: string): Promise<void> {
    try {
      // Publish empty message with KV-Operation header to delete the key
      const headers = createHeaders();
      headers.set('KV-Operation', 'DEL');
      headers.set('Nats-Msg-Id', `${bucket}-${key}-del-${Date.now()}`);
      
      this.connection.publish(
        `$KV.${bucket}.${key}`,
        new Uint8Array(0),
        { headers }
      );
      
      // Small delay to ensure the message is processed
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Failed to delete KV key:', error);
      throw error;
    }
  }
}

// Fetch all consumers across all streams
export async function fetchAllConsumers(): Promise<Record<string, unknown>[]> {
  try {
    const response = await fetch(`${config.nats.httpUrl}/jsz?consumers=1`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    const consumers: Record<string, unknown>[] = [];
    
    if (data.streams) {
      data.streams.forEach((stream: Record<string, unknown>) => {
        if (stream.consumer_detail) {
          (stream.consumer_detail as Record<string, unknown>[]).forEach((consumer: Record<string, unknown>) => {
            consumers.push({
              ...consumer,
              stream_name: stream.name
            });
          });
        }
      });
    }
    
    return consumers;
  } catch (error) {
    console.warn('Could not fetch consumers:', error);
    return [];
  }
}