import { useState, useCallback, useEffect, useRef } from 'react';
import { Users, Trash2, Info, Clock, TrendingUp } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { useNats } from '../hooks/useNats';
import { toast } from 'sonner';
import { fetchAllConsumers } from '../services/nats-service';
import { TableRowSkeleton } from '../components/ui/skeletons';

interface Consumer {
  name: string;
  stream: string;
  subject: string;
  deliverPolicy: 'all' | 'last' | 'new' | 'by_start_sequence' | 'by_start_time';
  ackPolicy: 'none' | 'all' | 'explicit';
  replayPolicy: 'instant' | 'original';
  maxDeliver: number;
  delivered: number;
  acknowledged: number;
  pending: number;
  redelivered: number;
  created: Date;
  lastActivity: Date;
  isActive: boolean;
}

// Helper function to convert JetStream API data to Consumer
function convertJetStreamConsumer(jsData: Record<string, unknown>): Consumer {
  const config = (jsData.config as Record<string, unknown>) || {};
  const delivered = (jsData.delivered as Record<string, unknown>) || {};
  const ackFloor = (jsData.ack_floor as Record<string, unknown>) || {};
  
  return {
    name: (config.name as string) || (jsData.name as string) || '',
    stream: (jsData.stream_name as string) || '',
    subject: (config.filter_subject as string) || '',
    deliverPolicy: ((config.deliver_policy as string) || 'all') as 'new' | 'all' | 'last' | 'by_start_sequence' | 'by_start_time',
    ackPolicy: ((config.ack_policy as string) || 'explicit') as 'none' | 'all' | 'explicit',
    replayPolicy: ((config.replay_policy as string) || 'instant') as 'instant' | 'original',
    maxDeliver: (config.max_deliver as number) || 0,
    delivered: (delivered.consumer_seq as number) || 0,
    acknowledged: (ackFloor.consumer_seq as number) || 0,
    pending: (jsData.num_pending as number) || 0,
    redelivered: (jsData.num_redelivered as number) || 0,
    created: new Date((jsData.created as string | number) || Date.now()),
    lastActivity: delivered.last_active ? new Date(delivered.last_active as string | number) : new Date(),
    isActive: (jsData.push_bound as boolean) || (jsData.num_waiting as number) > 0,
  };
}

export function Consumers() {
  const { connection, isConnected } = useNats();
  const [consumers, setConsumers] = useState<Consumer[]>([]);
  const [selectedConsumer, setSelectedConsumer] = useState<Consumer | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [consumerToDelete, setConsumerToDelete] = useState<{name: string; stream: string} | null>(null);
  const [showBlur, setShowBlur] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Fetch consumers from JetStream
  const fetchConsumers = useCallback(async () => {
    if (!isConnected || !connection) return;
    
    try {
      // Try to use JetStream API first, then fallback to HTTP monitoring API
      let consumersData: Record<string, unknown>[] = [];
      
      try {
        // Get all streams first
        const streams = await connection.jetstream.listStreams();
        
        // Get consumers for each stream
        for (const stream of streams) {
          const streamName = (stream.config as Record<string, unknown> | undefined)?.name as string || stream.name as string;
          if (streamName) {
            const streamConsumers = await connection.jetstream.listConsumers(streamName);
            consumersData.push(...streamConsumers.map((c: Record<string, unknown>) => ({ ...c, stream_name: streamName })));
          }
        }
      } catch {
        console.warn('JetStream API not available, using HTTP monitoring API');
        consumersData = await fetchAllConsumers();
      }
      
      const convertedConsumers = consumersData.map(convertJetStreamConsumer);
      setConsumers(convertedConsumers);
    } catch (error) {
      console.error('Failed to fetch consumers:', error);
      toast.error('Failed to fetch consumers');
    } finally {
      setInitialLoading(false);
    }
  }, [isConnected, connection]);

  const handleDeleteConsumer = useCallback(async (consumerName: string, streamName: string) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }

    try {
      await connection.jetstream.deleteConsumer(streamName, consumerName);
      toast.success(`Consumer ${consumerName} deleted`);
      
      // Refresh consumers list
      await fetchConsumers();
    } catch (err) {
      console.error('Delete consumer error:', err);
      toast.error(`Failed to delete consumer: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [connection, fetchConsumers]);

  // Check if table needs scroll blur
  const checkScrollBlur = useCallback(() => {
    if (tableContainerRef.current) {
      const { scrollHeight, clientHeight } = tableContainerRef.current;
      setShowBlur(scrollHeight > clientHeight);
    }
  }, []);

  // Load consumers on mount and when connection changes
  useEffect(() => {
    fetchConsumers();
    
    // Refresh consumers every 10 seconds when connected
    if (isConnected) {
      const interval = setInterval(fetchConsumers, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected, fetchConsumers]);

  // Check blur when consumers change
  useEffect(() => {
    checkScrollBlur();
    window.addEventListener('resize', checkScrollBlur);
    return () => window.removeEventListener('resize', checkScrollBlur);
  }, [consumers, checkScrollBlur]);

  const getActivityStatus = (lastActivity: Date) => {
    const now = new Date();
    const diffMinutes = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
    
    if (diffMinutes < 5) return { status: 'active', color: 'bg-green-500' };
    if (diffMinutes < 30) return { status: 'idle', color: 'bg-yellow-500' };
    return { status: 'stale', color: 'bg-gray-500' };
  };

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Consumers</h1>
            <p className="text-muted-foreground">
              Connect to NATS server to manage JetStream consumers
            </p>
          </div>
        </div>

      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold">Consumers</h1>
          <p className="text-muted-foreground">
            Monitor and manage JetStream consumers
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 flex-shrink-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Consumers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consumers.length}</div>
            <p className="text-xs text-muted-foreground">
              {consumers.filter(c => c.isActive).length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Messages Delivered</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {consumers.reduce((sum, c) => sum + c.delivered, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Total across all consumers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Messages</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {consumers.reduce((sum, c) => sum + c.pending, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting acknowledgment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redeliveries</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {consumers.reduce((sum, c) => sum + c.redelivered, 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Messages redelivered
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Consumers Table */}
      <Card className="flex-1 flex flex-col mt-6 overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            JetStream Consumers ({consumers.length})
          </CardTitle>
          <CardDescription>
            Overview of all JetStream consumers and their status
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden relative">
          {initialLoading ? (
            <div className="h-full overflow-auto" ref={tableContainerRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Stream</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Delivered</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Redelivered</TableHead>
                    <TableHead>Last Activity</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <TableRowSkeleton key={i} columns={9} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : consumers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full space-y-4">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center space-y-2">
                <h3 className="font-semibold">No consumers found</h3>
                <p className="text-sm text-muted-foreground">
                  Consumers will appear here once you create them
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto" ref={tableContainerRef}>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Stream</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivered</TableHead>
                  <TableHead>Pending</TableHead>
                  <TableHead>Redelivered</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consumers.map((consumer) => {
                  const activity = getActivityStatus(consumer.lastActivity);
                  return (
                    <TableRow key={consumer.name}>
                      <TableCell className="font-medium">{consumer.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{consumer.stream}</Badge>
                      </TableCell>
                      <TableCell>{consumer.subject}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${consumer.isActive ? activity.color : 'bg-red-500'}`} />
                          <Badge variant={consumer.isActive ? 'default' : 'secondary'}>
                            {consumer.isActive ? 'Active' : 'Stopped'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>{consumer.delivered.toLocaleString()}</TableCell>
                      <TableCell>
                        <span className={consumer.pending > 0 ? 'text-yellow-600 font-medium' : ''}>
                          {consumer.pending.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={consumer.redelivered > 0 ? 'text-red-600 font-medium' : ''}>
                          {consumer.redelivered.toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {consumer.lastActivity.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedConsumer(consumer)}
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                          <Dialog open={consumerToDelete?.name === consumer.name} onOpenChange={(open) => {
                            if (!open) setConsumerToDelete(null);
                          }}>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setConsumerToDelete({name: consumer.name, stream: consumer.stream})}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Delete Consumer</DialogTitle>
                                <DialogDescription>
                                  Are you sure you want to delete consumer "{consumer.name}" from stream "{consumer.stream}"? This action cannot be undone and will permanently remove the consumer.
                                </DialogDescription>
                              </DialogHeader>
                              <DialogFooter>
                                <Button
                                  variant="outline"
                                  onClick={() => setConsumerToDelete(null)}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  onClick={() => {
                                    if (consumerToDelete) {
                                      handleDeleteConsumer(consumerToDelete.name, consumerToDelete.stream);
                                    }
                                    setConsumerToDelete(null);
                                  }}
                                  className="bg-red-600 text-white hover:bg-red-700"
                                >
                                  Delete Consumer
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
          {/* Bottom fade effect - only show when scrollable */}
          {showBlur && !initialLoading && consumers.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          )}
        </CardContent>
      </Card>

      {/* Consumer Details Dialog */}
      {selectedConsumer && (
        <Dialog open={!!selectedConsumer} onOpenChange={() => setSelectedConsumer(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Consumer: {selectedConsumer.name}
              </DialogTitle>
              <DialogDescription>
                Detailed information and statistics for this consumer
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Stream:</span>
                      <Badge variant="outline">{selectedConsumer.stream}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Subject:</span>
                      <span className="text-sm font-medium">{selectedConsumer.subject}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Deliver Policy:</span>
                      <span className="text-sm font-medium">{selectedConsumer.deliverPolicy}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Ack Policy:</span>
                      <span className="text-sm font-medium">{selectedConsumer.ackPolicy}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Delivered:</span>
                      <span className="text-sm font-medium">{selectedConsumer.delivered.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Acknowledged:</span>
                      <span className="text-sm font-medium">{selectedConsumer.acknowledged.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Pending:</span>
                      <span className="text-sm font-medium text-yellow-600">{selectedConsumer.pending.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Redelivered:</span>
                      <span className="text-sm font-medium text-red-600">{selectedConsumer.redelivered.toLocaleString()}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <span className="text-sm font-medium">Max Deliver</span>
                  <p className="text-sm text-muted-foreground">{selectedConsumer.maxDeliver}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Created</span>
                  <p className="text-sm text-muted-foreground">{selectedConsumer.created.toLocaleDateString()}</p>
                </div>
                <div>
                  <span className="text-sm font-medium">Last Activity</span>
                  <p className="text-sm text-muted-foreground">{selectedConsumer.lastActivity.toLocaleString()}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${
                    selectedConsumer.isActive ? getActivityStatus(selectedConsumer.lastActivity).color : 'bg-red-500'
                  }`} />
                  <span className="text-sm font-medium">
                    Status: {selectedConsumer.isActive ? 'Active' : 'Stopped'}
                  </span>
                </div>
                <Badge variant={selectedConsumer.isActive ? 'default' : 'secondary'}>
                  {selectedConsumer.isActive ? 'Running' : 'Stopped'}
                </Badge>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}