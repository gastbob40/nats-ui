import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  GitBranch,
  Plus,
  Trash2,
  Info,
  Calendar,
  Users,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useNats } from '../hooks/useNats';
import { toast } from 'sonner';
import { fetchJetStreamStreams } from '../services/nats-service';
import { TableRowSkeleton } from '../components/ui/skeletons';

const createStreamSchema = z.object({
  name: z.string().min(1, 'Stream name is required').regex(/^[a-zA-Z0-9_-]+$/, 'Invalid stream name'),
  subjects: z.string().min(1, 'At least one subject is required'),
  description: z.string().optional(),
  retention: z.enum(['limits', 'interest', 'workqueue']),
  storage: z.enum(['file', 'memory']),
  maxMsgs: z.number().min(0),
  maxBytes: z.number().min(0),
  maxAge: z.number().min(0),
  replicas: z.number().min(1).max(5),
});

type CreateStreamFormData = z.infer<typeof createStreamSchema>;

interface StreamInfo {
  name: string;
  subjects: string[];
  description?: string;
  retention: 'limits' | 'interest' | 'workqueue';
  storage: 'file' | 'memory';
  messages: number;
  bytes: number;
  maxMsgs: number;
  maxBytes: number;
  maxAge: number;
  replicas: number;
  created: Date;
  consumers: number;
}

// Helper function to convert JetStream API data to StreamInfo
function convertJetStreamData(jsData: Record<string, unknown>): StreamInfo {
  const config = (jsData.config as Record<string, unknown>) || {};
  const state = (jsData.state as Record<string, unknown>) || {};
  
  return {
    name: (config.name as string) || '',
    subjects: (config.subjects as string[]) || [],
    description: (config.description as string) || '',
    retention: ((config.retention as string) || 'limits') as 'limits' | 'interest' | 'workqueue',
    storage: ((config.storage as string) || 'file') as 'file' | 'memory',
    messages: (state.messages as number) || 0,
    bytes: (state.bytes as number) || 0,
    maxMsgs: (config.max_msgs as number) || 0,
    maxBytes: (config.max_bytes as number) || 0,
    maxAge: (config.max_age as number) ? (config.max_age as number) / 1000000000 : 0, // Convert from nanoseconds
    replicas: (config.num_replicas as number) || 1,
    created: new Date((jsData.created as string | number) || Date.now()),
    consumers: (state.consumer_count as number) || 0,
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDuration(ms: number): string {
  if (ms === 0) return 'Forever';
  
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function Streams() {
  const { connection, isConnected } = useNats();
  const [streams, setStreams] = useState<StreamInfo[]>([]);
  const [selectedStream, setSelectedStream] = useState<StreamInfo | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [streamToDelete, setStreamToDelete] = useState<string | null>(null);
  const [showBlur, setShowBlur] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const form = useForm<CreateStreamFormData>({
    resolver: zodResolver(createStreamSchema),
    defaultValues: {
      name: '',
      subjects: '',
      description: '',
      retention: 'limits',
      storage: 'file',
      maxMsgs: 1000000,
      maxBytes: 1073741824, // 1GB
      maxAge: 0, // Forever
      replicas: 1,
    },
  });

  // Fetch streams from JetStream
  const fetchStreams = useCallback(async () => {
    if (!isConnected || !connection) return;
    
    setLoading(true);
    try {
      // Try to use JetStream API first, then fallback to HTTP monitoring API
      let streamsData: Record<string, unknown>[] = [];
      
      try {
        streamsData = await connection.jetstream.listStreams();
      } catch (jsError) {
        console.warn('JetStream API not available, using HTTP monitoring API', jsError);
        streamsData = await fetchJetStreamStreams();
      }
      
      const convertedStreams = streamsData.map(convertJetStreamData);
      setStreams(convertedStreams);
    } catch (error) {
      console.error('Failed to fetch streams:', error);
      // Only show error if JetStream is expected to be available
      if (error instanceof Error && !error.message.includes('not enabled')) {
        toast.error('Failed to fetch streams');
      }
    } finally {
      setLoading(false);
    }
  }, [isConnected, connection]);

  const handleCreateStream = useCallback(async (data: CreateStreamFormData) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }


    try {
      const streamConfig = {
        name: data.name,
        subjects: data.subjects.split(',').map(s => s.trim()),
        description: data.description,
        retention: data.retention,
        storage: data.storage,
        maxMsgs: data.maxMsgs,
        maxBytes: data.maxBytes,
        maxAge: data.maxAge,
        replicas: data.replicas,
      };

      await connection.jetstream.createStream(streamConfig);
      
      setIsCreateOpen(false);
      form.reset();
      toast.success(`Stream ${data.name} created successfully`);
      
      // Refresh streams list
      await fetchStreams();
    } catch (err) {
      console.error('Create stream error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Check for common JetStream issues
      if (errorMessage.includes('JetStream not enabled')) {
        toast.error('JetStream is not enabled on the NATS server');
      } else if (errorMessage.includes('already exists')) {
        toast.error(`Stream "${data.name}" already exists`);
      } else {
        toast.error(`Failed to create stream: ${errorMessage}`);
      }
    }
  }, [connection, form, fetchStreams]);

  const handleDeleteStream = useCallback(async (streamName: string) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }

    try {
      await connection.jetstream.deleteStream(streamName);
      toast.success(`Stream ${streamName} deleted`);
      
      // Refresh streams list
      await fetchStreams();
    } catch (err) {
      console.error('Delete stream error:', err);
      toast.error(`Failed to delete stream: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [connection, fetchStreams]);

  // Check if table needs scroll blur
  const checkScrollBlur = useCallback(() => {
    if (tableContainerRef.current) {
      const { scrollHeight, clientHeight } = tableContainerRef.current;
      setShowBlur(scrollHeight > clientHeight);
    }
  }, []);

  // Load streams on mount and when connection changes
  useEffect(() => {
    fetchStreams();
    
    // Refresh streams every 10 seconds when connected
    if (isConnected) {
      const interval = setInterval(fetchStreams, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected, fetchStreams]);

  // Check blur when streams change
  useEffect(() => {
    checkScrollBlur();
    window.addEventListener('resize', checkScrollBlur);
    return () => window.removeEventListener('resize', checkScrollBlur);
  }, [streams, checkScrollBlur]);

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Streams</h1>
            <p className="text-muted-foreground">
              Connect to NATS server to manage JetStream streams
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
          <h1 className="text-3xl font-bold">Streams</h1>
          <p className="text-muted-foreground">
            Manage JetStream streams and their configurations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Stream
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Stream</DialogTitle>
                <DialogDescription>
                  Configure a new JetStream stream to store and replay messages.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(handleCreateStream)} className="space-y-6">
                <Tabs defaultValue="basic" className="space-y-4">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="basic">Basic</TabsTrigger>
                    <TabsTrigger value="limits">Limits & Storage</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="basic" className="space-y-4">
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Stream Name</Label>
                        <Input
                          id="name"
                          placeholder="e.g., ORDERS"
                          {...form.register('name')}
                        />
                        {form.formState.errors.name && (
                          <p className="text-sm text-red-600">
                            {form.formState.errors.name.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="subjects">Subjects (comma-separated)</Label>
                        <Input
                          id="subjects"
                          placeholder="e.g., orders.*, order.created"
                          {...form.register('subjects')}
                        />
                        {form.formState.errors.subjects && (
                          <p className="text-sm text-red-600">
                            {form.formState.errors.subjects.message}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="description">Description (optional)</Label>
                        <Textarea
                          id="description"
                          placeholder="Stream description..."
                          {...form.register('description')}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="retention">Retention Policy</Label>
                          <Select {...form.register('retention')}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select retention" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="limits">Limits</SelectItem>
                              <SelectItem value="interest">Interest</SelectItem>
                              <SelectItem value="workqueue">Work Queue</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="storage">Storage Type</Label>
                          <Select {...form.register('storage')}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select storage" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="file">File</SelectItem>
                              <SelectItem value="memory">Memory</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="limits" className="space-y-4">
                    <div className="grid gap-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxMsgs">Max Messages</Label>
                          <Input
                            id="maxMsgs"
                            type="number"
                            min="0"
                            {...form.register('maxMsgs', { valueAsNumber: true })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="maxBytes">Max Bytes</Label>
                          <Input
                            id="maxBytes"
                            type="number"
                            min="0"
                            {...form.register('maxBytes', { valueAsNumber: true })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="maxAge">Max Age (seconds, 0 = forever)</Label>
                          <Input
                            id="maxAge"
                            type="number"
                            min="0"
                            {...form.register('maxAge', { valueAsNumber: true })}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="replicas">Replicas</Label>
                          <Input
                            id="replicas"
                            type="number"
                            min="1"
                            max="5"
                            {...form.register('replicas', { valueAsNumber: true })}
                          />
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    Create Stream
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Streams Table */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            JetStream Streams ({streams.length})
          </CardTitle>
          <CardDescription>
            Overview of all configured JetStream streams
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden relative">
          {loading ? (
            <div className="h-full overflow-auto" ref={tableContainerRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Subjects</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Consumers</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-20">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <TableRowSkeleton key={i} columns={8} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : streams.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 space-y-4">
              <GitBranch className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center space-y-2">
                <h3 className="font-semibold">No streams configured</h3>
                <p className="text-sm text-muted-foreground">
                  Create your first JetStream stream to get started
                </p>
              </div>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Stream
              </Button>
            </div>
          ) : (
            <div className="h-full overflow-auto" ref={tableContainerRef}>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Consumers</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {streams.map((stream) => (
                  <TableRow key={stream.name}>
                    <TableCell className="font-medium">{stream.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {stream.subjects.map((subject) => (
                          <Badge key={subject} variant="secondary" className="text-xs">
                            {subject}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{stream.messages.toLocaleString()}</TableCell>
                    <TableCell>{formatBytes(stream.bytes)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {stream.consumers}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={stream.storage === 'file' ? 'default' : 'secondary'}>
                        {stream.storage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {stream.created.toLocaleDateString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedStream(stream)}
                        >
                          <Info className="h-4 w-4" />
                        </Button>
                        <Dialog open={streamToDelete === stream.name} onOpenChange={(open) => {
                          if (!open) setStreamToDelete(null);
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setStreamToDelete(stream.name)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete Stream</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete stream "{stream.name}"? This action cannot be undone and will permanently remove all messages in the stream.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button
                                variant="outline"
                                onClick={() => setStreamToDelete(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => {
                                  handleDeleteStream(stream.name);
                                  setStreamToDelete(null);
                                }}
                                className="bg-red-600 text-white hover:bg-red-700"
                              >
                                Delete Stream
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
          {/* Bottom fade effect - only show when scrollable */}
          {showBlur && !loading && streams.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          )}
        </CardContent>
      </Card>

      {/* Stream Details Dialog */}
      {selectedStream && (
        <Dialog open={!!selectedStream} onOpenChange={() => setSelectedStream(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Stream: {selectedStream.name}
              </DialogTitle>
              <DialogDescription>
                Detailed information and configuration for this stream
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Storage Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Messages:</span>
                      <span className="text-sm font-medium">{selectedStream.messages.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Size:</span>
                      <span className="text-sm font-medium">{formatBytes(selectedStream.bytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Storage:</span>
                      <Badge variant={selectedStream.storage === 'file' ? 'default' : 'secondary'}>
                        {selectedStream.storage}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Limits</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Max Messages:</span>
                      <span className="text-sm font-medium">{selectedStream.maxMsgs.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Max Size:</span>
                      <span className="text-sm font-medium">{formatBytes(selectedStream.maxBytes)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Max Age:</span>
                      <span className="text-sm font-medium">{formatDuration(selectedStream.maxAge)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Subjects</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedStream.subjects.map((subject) => (
                      <Badge key={subject} variant="outline">
                        {subject}
                      </Badge>
                    ))}
                  </div>
                </div>

                {selectedStream.description && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground mt-1">{selectedStream.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Retention</Label>
                    <p className="text-sm text-muted-foreground">{selectedStream.retention}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Replicas</Label>
                    <p className="text-sm text-muted-foreground">{selectedStream.replicas}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Consumers</Label>
                    <p className="text-sm text-muted-foreground">{selectedStream.consumers}</p>
                  </div>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}