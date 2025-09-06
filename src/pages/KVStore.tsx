import { useState, useCallback, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Database,
  Plus,
  Trash2,
  Edit3,
  Search,
  Key,
  Calendar,
  Download,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
// import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
// import { ScrollArea } from '../components/ui/scroll-area';
import { useNats } from '../hooks/useNats';
import { toast } from 'sonner';
import { TableRowSkeleton } from '../components/ui/skeletons';

const kvSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.string().min(1, 'Value is required'),
});

const bucketSchema = z.object({
  name: z.string().min(1, 'Bucket name is required').regex(/^[a-zA-Z0-9_-]+$/, 'Invalid bucket name'),
  ttl: z.number().optional(),
});

type KVFormData = z.infer<typeof kvSchema>;
type BucketFormData = z.infer<typeof bucketSchema>;

interface KVEntry {
  key: string;
  value: string;
  revision: number;
  created: Date;
  updated: Date;
  bucket: string;
}

// interface KVBucket {
//   name: string;
//   ttl?: number;
//   entries: number;
//   size: number;
//   created: Date;
// }


export function KVStore() {
  const { connection, isConnected } = useNats();
  const [entries, setEntries] = useState<KVEntry[]>([]);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<KVEntry | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateBucketOpen, setIsCreateBucketOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentBucket, setCurrentBucket] = useState<string>('');
  const [showBlur, setShowBlur] = useState(false);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const form = useForm<KVFormData>({
    resolver: zodResolver(kvSchema),
    defaultValues: {
      key: '',
      value: '',
    },
  });

  const bucketForm = useForm<BucketFormData>({
    resolver: zodResolver(bucketSchema),
    defaultValues: {
      name: '',
      ttl: undefined,
    },
  });

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         entry.value.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBucket = selectedBucket === 'all' || entry.bucket === selectedBucket;
    return matchesSearch && matchesBucket;
  });

  // Fetch buckets and their entries
  const fetchKVData = useCallback(async () => {
    if (!isConnected || !connection) return;
    
    setLoading(true);
    try {
      // Get all KV buckets
      const kvBuckets = await connection.jetstream.listKVBuckets();
      setBuckets(kvBuckets);
      
      // Get entries for each bucket
      const allEntries: KVEntry[] = [];
      
      for (const bucket of kvBuckets) {
        const keys = await connection.jetstream.getKVKeys(bucket);
        
        for (const key of keys) {
          const value = await connection.jetstream.getKVValue(bucket, key);
          
          if (value !== null) {
            allEntries.push({
              key,
              value,
              revision: 1, // Would need to get from stream metadata
              created: new Date(), // Would need to get from stream metadata
              updated: new Date(), // Would need to get from stream metadata
              bucket,
            });
          }
        }
      }
      
      setEntries(allEntries);
    } catch (error) {
      console.error('Failed to fetch KV data:', error);
      // Don't show error toast as KV might not be configured
    } finally {
      setLoading(false);
    }
  }, [isConnected, connection]);

  // Load KV data on mount and when connection changes
  useEffect(() => {
    fetchKVData();
    
    // Refresh data every 10 seconds when connected
    if (isConnected) {
      const interval = setInterval(fetchKVData, 10000);
      return () => clearInterval(interval);
    }
  }, [isConnected, fetchKVData]);

  const handleCreateBucket = useCallback(async (data: BucketFormData) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }


    try {
      await connection.jetstream.createKVBucket(data.name, data.ttl);
      toast.success(`Created bucket: ${data.name}`);
      
      setIsCreateBucketOpen(false);
      bucketForm.reset();
      
      // Refresh data
      await fetchKVData();
    } catch (err) {
      console.error('Create bucket error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      // Check for common JetStream issues
      if (errorMessage.includes('JetStream not enabled')) {
        toast.error('JetStream is not enabled on the NATS server');
      } else if (errorMessage.includes('already exists')) {
        toast.error(`Bucket "${data.name}" already exists`);
      } else {
        toast.error(`Failed to create bucket: ${errorMessage}`);
      }
    }
  }, [connection, bucketForm, fetchKVData]);

  const handleCreateOrUpdate = useCallback(async (data: KVFormData) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }

    try {
      const bucket = isEditMode ? selectedEntry?.bucket : (currentBucket || buckets[0]);
      if (!bucket) {
        toast.error('No bucket selected');
        return;
      }

      await connection.jetstream.putKVValue(bucket, data.key, data.value);
      
      if (isEditMode && selectedEntry) {
        toast.success(`Updated key: ${selectedEntry.key}`);
      } else {
        toast.success(`Created key: ${data.key} in bucket: ${bucket}`);
      }

      setIsCreateOpen(false);
      setIsEditMode(false);
      setSelectedEntry(null);
      form.reset();
      
      // Refresh data with immediate and delayed attempts
      await fetchKVData();
      
      // Try again after a delay to catch any async updates
      setTimeout(async () => {
        await fetchKVData();
      }, 1500);
    } catch (err) {
      console.error('KV operation error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to save key-value pair: ${errorMessage}`);
    }
  }, [connection, isEditMode, selectedEntry, form, currentBucket, buckets, fetchKVData]);

  const handleEdit = useCallback((entry: KVEntry) => {
    setSelectedEntry(entry);
    setIsEditMode(true);
    setIsCreateOpen(true);
    form.reset({
      key: entry.key,
      value: entry.value,
    });
  }, [form]);

  const handleDelete = useCallback(async (key: string, bucket: string) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }

    try {
      await connection.jetstream.deleteKVKey(bucket, key);
      toast.success(`Deleted key: ${key}`);
      
      // Refresh data
      await fetchKVData();
    } catch (err) {
      console.error('Delete key error:', err);
      toast.error(`Failed to delete key: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [connection, fetchKVData]);

  const handleDeleteBucket = useCallback(async (bucket: string) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }

    try {
      await connection.jetstream.deleteKVBucket(bucket);
      toast.success(`Deleted bucket: ${bucket}`);
      
      // Refresh data
      await fetchKVData();
    } catch (err) {
      console.error('Delete bucket error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete bucket: ${errorMessage}`);
    }
  }, [connection, fetchKVData]);

  // Check if table needs scroll blur
  const checkScrollBlur = useCallback(() => {
    if (tableContainerRef.current) {
      const { scrollHeight, clientHeight } = tableContainerRef.current;
      setShowBlur(scrollHeight > clientHeight);
    }
  }, []);

  // Check blur when entries change
  useEffect(() => {
    checkScrollBlur();
    window.addEventListener('resize', checkScrollBlur);
    return () => window.removeEventListener('resize', checkScrollBlur);
  }, [filteredEntries, checkScrollBlur]);

  const handleExport = useCallback(() => {
    const exportData = filteredEntries.reduce((acc, entry) => {
      acc[`${entry.bucket}.${entry.key}`] = {
        value: entry.value,
        revision: entry.revision,
        created: entry.created.toISOString(),
        updated: entry.updated.toISOString(),
      };
      return acc;
    }, {} as Record<string, unknown>);

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kv-store-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success('Key-value data exported successfully');
  }, [filteredEntries]);

  if (!isConnected) {
    return (
      <div className="h-full flex flex-col p-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">KV Store</h1>
            <p className="text-muted-foreground">
              Connect to NATS server to manage key-value storage
            </p>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center py-12">
          <div className="max-w-md">
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold">KV Store</h1>
          <p className="text-muted-foreground">
            Manage NATS JetStream key-value storage
          </p>
        </div>
        <div className="flex items-center gap-2">
          
          {/* Create Bucket Dialog */}
          <Dialog
            open={isCreateBucketOpen}
            onOpenChange={setIsCreateBucketOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <Database className="mr-2 h-4 w-4" />
                Create Bucket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create KV Bucket</DialogTitle>
                <DialogDescription>
                  Create a new key-value storage bucket
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={bucketForm.handleSubmit(handleCreateBucket)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bucket-name">Bucket Name</Label>
                  <Input
                    id="bucket-name"
                    placeholder="e.g., CONFIG"
                    {...bucketForm.register('name')}
                  />
                  {bucketForm.formState.errors.name && (
                    <p className="text-sm text-red-600">
                      {bucketForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bucket-ttl">TTL (seconds, optional)</Label>
                  <Input
                    id="bucket-ttl"
                    type="number"
                    placeholder="Leave empty for no expiration"
                    {...bucketForm.register('ttl', { valueAsNumber: true })}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateBucketOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={bucketForm.formState.isSubmitting}>
                    Create Bucket
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Add Key-Value Dialog */}
          <Dialog 
            open={isCreateOpen} 
            onOpenChange={(open) => {
              setIsCreateOpen(open);
              if (!open) {
                setIsEditMode(false);
                setSelectedEntry(null);
                form.reset();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button disabled={buckets.length === 0}>
                <Plus className="mr-2 h-4 w-4" />
                Add Key-Value
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {isEditMode ? 'Edit Key-Value Pair' : 'Create Key-Value Pair'}
                </DialogTitle>
                <DialogDescription>
                  {isEditMode 
                    ? 'Update the value for this key'
                    : buckets.length === 0 
                      ? 'Please create a bucket first'
                      : 'Add a new key-value pair to the store'
                  }
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(handleCreateOrUpdate)} className="space-y-4">
                {!isEditMode && buckets.length > 0 && (
                  <div className="space-y-2">
                    <Label htmlFor="bucket-select">Bucket</Label>
                    <select
                      id="bucket-select"
                      value={currentBucket || buckets[0]}
                      onChange={(e) => setCurrentBucket(e.target.value)}
                      className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm"
                    >
                      {buckets.map(bucket => (
                        <option key={bucket} value={bucket}>{bucket}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="key">Key</Label>
                  <Input
                    id="key"
                    placeholder="e.g., config.database.host"
                    {...form.register('key')}
                    disabled={isEditMode}
                  />
                  {form.formState.errors.key && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.key.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="value">Value</Label>
                  <Textarea
                    id="value"
                    placeholder="Enter the value..."
                    rows={4}
                    {...form.register('value')}
                  />
                  {form.formState.errors.value && (
                    <p className="text-sm text-red-600">
                      {form.formState.errors.value.message}
                    </p>
                  )}
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={form.formState.isSubmitting || buckets.length === 0}>
                    {isEditMode ? 'Update' : 'Create'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6 flex-shrink-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Keys</CardTitle>
            <Key className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{entries.length}</div>
            <p className="text-xs text-muted-foreground">
              Across {buckets.length} buckets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Buckets</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{buckets.length}</div>
            <p className="text-xs text-muted-foreground">
              Active storage buckets
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Updated</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.max(...entries.map(e => e.updated.getTime())) ? 
                new Date(Math.max(...entries.map(e => e.updated.getTime()))).toLocaleDateString()
                : 'Never'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Most recent update
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revisions</CardTitle>
            <Edit3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {entries.reduce((sum, entry) => sum + entry.revision, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Cumulative revisions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bucket Management */}
      {buckets.length > 0 && (
        <Card className="mb-6 flex-shrink-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Buckets ({buckets.length})
            </CardTitle>
            <CardDescription>
              Manage your KV buckets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {buckets.map(bucket => (
                <div key={bucket} className="flex items-center gap-2 px-3 py-2 bg-muted rounded-lg">
                  <span className="text-sm font-medium">{bucket}</span>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete Bucket</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete bucket "{bucket}"? This will permanently delete all keys in this bucket and cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="outline">Cancel</Button>
                        <Button
                          onClick={() => handleDeleteBucket(bucket)}
                          className="bg-red-600 text-white hover:bg-red-700"
                        >
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Search */}
      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Key-Value Store ({filteredEntries.length})
            {loading && entries.length > 0 && (
              <div className="ml-auto">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </CardTitle>
          <CardDescription>
            Browse and manage your key-value pairs
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col relative">
          <div className="flex items-center gap-4 flex-shrink-0 pb-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search keys or values..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="bucket-filter" className="text-sm font-medium whitespace-nowrap">
                Bucket:
              </Label>
              <select
                id="bucket-filter"
                value={selectedBucket}
                onChange={(e) => setSelectedBucket(e.target.value)}
                className="px-3 py-2 border border-input bg-background rounded-md text-sm"
              >
                <option value="all">All Buckets</option>
                {buckets.map(bucket => (
                  <option key={bucket} value={bucket}>{bucket}</option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={filteredEntries.length === 0}
              >
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {loading && entries.length === 0 ? (
            <div className="h-full overflow-auto" ref={tableContainerRef}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Key</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Bucket</TableHead>
                    <TableHead>Revision</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <TableRowSkeleton key={i} columns={6} />
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Key className="h-12 w-12 text-muted-foreground/50" />
              <div className="text-center space-y-2">
                <h3 className="font-semibold">
                  {searchTerm || selectedBucket !== 'all' 
                    ? 'No matching keys found' 
                    : 'No key-value pairs'
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || selectedBucket !== 'all'
                    ? 'Try adjusting your search or filter criteria'
                    : 'Create your first key-value pair to get started'
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-auto" ref={tableContainerRef}>
              <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Revision</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map((entry) => (
                  <TableRow key={`${entry.bucket}-${entry.key}`}>
                    <TableCell className="font-medium font-mono text-sm">
                      {entry.key}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <div className="truncate" title={entry.value}>
                        {entry.value}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entry.bucket}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">v{entry.revision}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {entry.updated.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(entry)}
                        >
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Delete Key</DialogTitle>
                              <DialogDescription>
                                Are you sure you want to delete key "{entry.key}" from bucket "{entry.bucket}"? This action cannot be undone.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline">Cancel</Button>
                              <Button
                                onClick={() => handleDelete(entry.key, entry.bucket)}
                                className="bg-red-600 text-white hover:bg-red-700"
                              >
                                Delete
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
          {showBlur && !loading && filteredEntries.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}