import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Send,
  MessageSquare,
  Play,
  Square,
  Trash2,
  Download,
  Copy,
  Clock,
  Plus,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  MoreVertical,
  Inbox,
  MailX,
} from 'lucide-react';

import {cn } from '@/lib/utils';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { JsonViewer } from '../components/ui/json-viewer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '../components/ui/collapsible';
import { useNats } from '../hooks/useNats';
import { toast } from 'sonner';
import { fetchActiveSubjects } from '../services/nats-service';
import { subjectTracker, type SubjectActivity } from '../services/subject-tracker';
import { TopicSkeleton } from '../components/ui/skeletons';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';

const publishSchema = z.object({
  data: z.string(),
  headers: z.string().optional(),
});

const subscribeSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  queueGroup: z.string().optional(),
});

type PublishFormData = z.infer<typeof publishSchema>;
type SubscribeFormData = z.infer<typeof subscribeSchema>;

// Memoized message item component to prevent unnecessary re-renders
const MessageItem = memo(({ 
  message, 
  isHeaderExpanded, 
  onToggleHeader, 
  onCopyBody,
  onCopyHeaders,
  onCopyAll
}: {
  message: Message;
  isHeaderExpanded: boolean;
  onToggleHeader: (messageId: string) => void;
  onCopyBody: (message: Message) => void;
  onCopyHeaders: (message: Message) => void;
  onCopyAll: (message: Message) => void;
}) => {
  // Memoize expensive computations
  const isJsonData = useMemo(() => {
    try {
      JSON.parse(message.data);
      return true;
    } catch {
      return false;
    }
  }, [message.data]);

  const hasJsonContentType = useMemo(() => {
    return message.headers?.['Content-Type']?.includes('json') || 
           message.headers?.['content-type']?.includes('json');
  }, [message.headers]);

  const handleToggleHeader = useCallback(() => {
    onToggleHeader(message.id);
  }, [onToggleHeader, message.id]);

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{message.subject}</Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {message.timestamp.toLocaleString()}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              title="Copy options"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onCopyBody(message)}>
              <Copy className="h-3 w-3 mr-2" />
              Copy Body
            </DropdownMenuItem>
            {message.headers && Object.keys(message.headers).length > 0 && (
              <DropdownMenuItem onClick={() => onCopyHeaders(message)}>
                <Copy className="h-3 w-3 mr-2" />
                Copy Headers
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => onCopyAll(message)}>
              <Copy className="h-3 w-3 mr-2" />
              Copy All
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {message.headers && Object.keys(message.headers).length > 0 && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-between p-0 h-auto font-normal"
            onClick={handleToggleHeader}
          >
            <div className="flex items-center gap-1">
              {isHeaderExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              <Label className="text-xs font-medium cursor-pointer">
                Headers ({Object.keys(message.headers).length})
              </Label>
            </div>
          </Button>
          {isHeaderExpanded && (
            <div className="mt-2 text-sm bg-muted p-2 rounded font-mono space-y-1">
              {Object.entries(message.headers).map(([key, value]) => (
                <div key={key} className="flex gap-2">
                  <span className="text-blue-600 dark:text-blue-400">{key}:</span>
                  <span className="text-muted-foreground">{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {message.data && (
        <div className="space-y-1">
          <Label className="text-xs font-medium">Data:</Label>
          {(isJsonData || hasJsonContentType) ? (
            <JsonViewer data={message.data} defaultExpanded={true} />
          ) : (
            <pre className="text-sm bg-muted p-2 rounded overflow-x-auto font-mono">
              {message.data}
            </pre>
          )}
        </div>
      )}

      {message.replyTo && (
        <div className="space-y-1">
          <Label className="text-xs font-medium">Reply To:</Label>
          <span className="text-sm text-muted-foreground font-mono">{message.replyTo}</span>
        </div>
      )}
    </div>
  );
});

interface Message {
  id: string;
  subject: string;
  data: string;
  headers?: Record<string, string>;
  timestamp: Date;
  replyTo?: string;
}

interface Subscription {
  id: string;
  subject: string;
  queueGroup?: string;
  messageCount: number;
  isActive: boolean;
  unsubscribe?: () => void;
}


const MessagesComponent = function Messages() {
  const { connection, isConnected } = useNats();
  const [messages, setMessages] = useState<Message[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [expandedHeaders, setExpandedHeaders] = useState<Set<string>>(new Set());
  const [hideInboxTopics, setHideInboxTopics] = useState(true);
  const [isAddTopicOpen, setIsAddTopicOpen] = useState(false);
  const [newTopicName, setNewTopicName] = useState('');

  // State for publish card collapsible behavior
  const [isPublishExpanded, setIsPublishExpanded] = useState(() => {
    // Default to collapsed on smaller screens, expanded on larger screens
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024; // lg breakpoint
    }
    return true; // Server-side render default
  });

  // Memoized computations to prevent unnecessary re-renders
  const filteredMessages = useMemo(() => {
    if (!selectedTopic) return [];
    return messages.filter(m => m.subject === selectedTopic);
  }, [messages, selectedTopic]);

  // State for subject activities that updates when subjects change
  const [subjectActivities, setSubjectActivities] = useState<Map<string, SubjectActivity>>(new Map());

  // Memoized topic list data with stable references
  const topicListData = useMemo(() => {
    const selectedTopicRef = selectedTopic;
    const subscriptionsRef = subscriptions;

    // Filter out _INBOX topics if hideInboxTopics is true
    const filteredTopics = hideInboxTopics
      ? topics.filter(topic => !topic.startsWith('_INBOX.'))
      : topics;

    return filteredTopics.map((topic) => {
      const activity = subjectActivities.get(topic);
      const isSelected = selectedTopicRef === topic;
      const isSubscribed = subscriptionsRef.some(s => s.subject === topic && s.isActive);

      return {
        topic,
        activity,
        isSelected,
        isSubscribed
      };
    });
  }, [topics, subjectActivities, selectedTopic, subscriptions, hideInboxTopics]);
  
  // Memoized topic list component to prevent re-renders
  const TopicListMemoized = useMemo(() => {
    if (isLoadingTopics) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <TopicSkeleton key={i} />
          ))}
        </div>
      );
    }
    
    if (topics.length === 0) {
      return <p className="text-sm text-muted-foreground">No topics found</p>;
    }
    
    return (
      <div className="space-y-2">
        {topicListData.map(({ topic, activity, isSelected, isSubscribed }) => {
          return (
            <div
              key={topic}
              className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
              }`}
              onClick={() => setSelectedTopic(topic)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-sm truncate">{topic}</span>
                {isSubscribed && (
                  <Badge variant="default" className="text-xs">
                    Subscribed
                  </Badge>
                )}
              </div>
              {activity && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{activity.messageCount} messages</span>
                  <span>•</span>
                  <span>{new Date(activity.lastSeen).toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }, [topics, topicListData, isLoadingTopics, setSelectedTopic]);

  const publishForm = useForm<PublishFormData>({
    resolver: zodResolver(publishSchema),
    defaultValues: {
      data: '',
      headers: '',
    },
  });

  const subscribeForm = useForm<SubscribeFormData>({
    resolver: zodResolver(subscribeSchema),
    defaultValues: {
      subject: '',
      queueGroup: '',
    },
  });

  const handlePublish = useCallback(async (data: PublishFormData & { subject: string }) => {
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }

    try {
      let headers: Record<string, string> | undefined;

      // Parse headers if provided
      if (data.headers?.trim()) {
        try {
          headers = JSON.parse(data.headers);
        } catch {
          toast.error('Invalid JSON in headers field');
          return;
        }
      }

      // Use our NatsService publish method with headers
      await connection.publish(data.subject, data.data, headers);

      toast.success(`Message published to ${data.subject}`);
      publishForm.reset();
    } catch (err) {
      console.error('Publish error:', err);
      toast.error('Failed to publish message');
    }
  }, [connection, publishForm]);

  const handleSubscribe = useCallback(async (data: SubscribeFormData) => {
    
    if (!connection) {
      toast.error('Not connected to NATS server');
      return;
    }

    try {
      const subscriptionId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      
      // Add to subscriptions list
      const newSubscription: Subscription = {
        id: subscriptionId,
        subject: data.subject,
        queueGroup: data.queueGroup,
        messageCount: 0,
        isActive: true,
      };

      setSubscriptions(prev => [...prev, newSubscription]);

      // Subscribe using our NatsService
      const unsubscribe = await connection.subscribe(data.subject, (msg: { subject: string; data: unknown; headers?: Record<string, string>; timestamp: number; reply?: string }) => {
        
        const message: Message = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          subject: msg.subject,
          data: typeof msg.data === 'string' ? msg.data : JSON.stringify(msg.data),
          headers: msg.headers, // Headers are now directly available from the message
          timestamp: new Date(msg.timestamp),
          replyTo: msg.reply,
        };

        setMessages(prev => [message, ...prev.slice(0, 999)]); // Keep only last 1000 messages
        
        // Update message count
        setSubscriptions(prev => prev.map(s => 
          s.id === subscriptionId ? { ...s, messageCount: s.messageCount + 1 } : s
        ));
      });

      // Store the unsubscribe function for later use
      setSubscriptions(prev => prev.map(s => 
        s.id === subscriptionId ? { ...s, unsubscribe } : s
      ));

      toast.success(`Subscribed to ${data.subject}`);
      subscribeForm.reset();
    } catch (err) {
      console.error('Subscribe error:', err);
      toast.error('Failed to subscribe to subject');
    }
  }, [connection, subscribeForm]);

  const handleUnsubscribe = useCallback((subscriptionId: string) => {
    setSubscriptions(prev => prev.map(s => {
      if (s.id === subscriptionId) {
        // Call the actual unsubscribe function
        if (s.unsubscribe) {
          try {
            s.unsubscribe();
          } catch (err) {
            console.error('Error unsubscribing:', err);
          }
        }
        return { ...s, isActive: false };
      }
      return s;
    }));
    toast.success('Unsubscribed');
  }, []);


  const toggleHeaderExpansion = useCallback((messageId: string) => {
    setExpandedHeaders(current => {
      const newSet = new Set(current);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  }, []);

  const copyMessageBody = useCallback((message: Message) => {
    try {
      const parsedData = JSON.parse(message.data);
      navigator.clipboard.writeText(JSON.stringify(parsedData, null, 2));
    } catch {
      navigator.clipboard.writeText(message.data);
    }
    toast.success('Message body copied to clipboard');
  }, []);

  const copyMessageHeaders = useCallback((message: Message) => {
    if (message.headers && Object.keys(message.headers).length > 0) {
      navigator.clipboard.writeText(JSON.stringify(message.headers, null, 2));
      toast.success('Message headers copied to clipboard');
    } else {
      toast.error('No headers to copy');
    }
  }, []);

  const copyMessageAll = useCallback((message: Message) => {
    const messageJson = {
      subject: message.subject,
      data: (() => {
        try {
          return JSON.parse(message.data);
        } catch {
          return message.data;
        }
      })(),
      headers: message.headers,
      timestamp: message.timestamp.toISOString(),
      ...(message.replyTo && { replyTo: message.replyTo }),
    };
    
    navigator.clipboard.writeText(JSON.stringify(messageJson, null, 2));
    toast.success('Complete message copied to clipboard as JSON');
  }, []);

  // Cache for server topics with timestamp to avoid excessive HTTP calls
  const serverTopicsCache = useRef<{ topics: Set<string>; timestamp: number }>({ topics: new Set(), timestamp: 0 });
  const lastTopicsHash = useRef<string>('');
  
  // Optimized topic comparison using Set-based hashing
  const createTopicsHash = useCallback((topicArray: string[]): string => {
    return topicArray.sort().join('|');
  }, []);

  // Fetch topics from server (HTTP API) with intelligent caching
  const fetchServerTopics = useCallback(async (): Promise<Set<string>> => {
    if (!isConnected) return new Set();
    
    const now = Date.now();
    const cacheAge = now - serverTopicsCache.current.timestamp;
    
    // Use cached server topics if less than 30 seconds old
    if (cacheAge < 30000 && serverTopicsCache.current.topics.size > 0) {
      return serverTopicsCache.current.topics;
    }
    
    try {
      const serverTopics = await fetchActiveSubjects();
      const serverTopicsSet = new Set(serverTopics);
      
      // Update cache
      serverTopicsCache.current = {
        topics: serverTopicsSet,
        timestamp: now
      };
      
      return serverTopicsSet;
    } catch (error) {
      console.warn('Failed to fetch server topics:', error);
      // Return cached topics even if stale, or empty set
      return serverTopicsCache.current.topics;
    }
  }, [isConnected]);

  // Combine and deduplicate topics from both sources
  const fetchTopics = useCallback(async () => {
    if (!isConnected) return;
    
    try {
      setIsLoadingTopics(true);
      
      // Get topics from both sources
      const [serverTopicsSet, subjectTrackerTopics] = await Promise.all([
        fetchServerTopics(),
        Promise.resolve(subjectTracker.getSubjects().map(s => s.subject))
      ]);
      
      // Combine and deduplicate using Set for optimal performance
      const allTopicsSet = new Set([...serverTopicsSet, ...subjectTrackerTopics]);
      const newTopics = Array.from(allTopicsSet).sort();
      
      // Smart comparison using hash to prevent unnecessary re-renders
      const newHash = createTopicsHash(newTopics);
      
      if (newHash !== lastTopicsHash.current) {
        lastTopicsHash.current = newHash;
        setTopics(newTopics);
      }
    } catch (error) {
      console.error('Failed to fetch topics:', error);
    } finally {
      setIsLoadingTopics(false);
    }
  }, [isConnected, fetchServerTopics]);

  // Smart polling with different intervals for different sources
  useEffect(() => {
    if (!isConnected) return;
    
    // Initial fetch
    fetchTopics();
    
    // Server topics: Poll every 30 seconds (less frequent to reduce HTTP calls)
    const serverInterval = setInterval(async () => {
      // Only fetch server topics, subject tracker updates will be handled separately
      try {
        const serverTopicsSet = await fetchServerTopics();
        const subjectTrackerTopics = subjectTracker.getSubjects().map(s => s.subject);
        const allTopicsSet = new Set([...serverTopicsSet, ...subjectTrackerTopics]);
        const newTopics = Array.from(allTopicsSet).sort();
        const newHash = createTopicsHash(newTopics);
        
        if (newHash !== lastTopicsHash.current) {
          lastTopicsHash.current = newHash;
          setTopics(newTopics);
        }
      } catch (error) {
        console.error('Failed to update server topics:', error);
      }
    }, 30000);
    
    return () => clearInterval(serverInterval);
  }, [isConnected, fetchServerTopics, createTopicsHash]);

  // Handle responsive collapse state for publish card
  useEffect(() => {
    const handleResize = () => {
      const isLarge = window.innerWidth >= 1024; // lg breakpoint
      setIsPublishExpanded(isLarge);
    };

    // Set initial state
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update subject activities when they change
  useEffect(() => {
    const updateActivities = () => {
      const subjects = subjectTracker.getSubjects();
      const activitiesMap = new Map(subjects.map(s => [s.subject, s]));
      setSubjectActivities(activitiesMap);
    };
    
    // Initial update
    updateActivities();
    
    // Subscribe to subject tracker changes
    const unsubscribe = subjectTracker.subscribe(updateActivities);
    
    return () => unsubscribe();
  }, []);

  // Subject tracker updates: Debounced and intelligent
  useEffect(() => {
    if (!isConnected) return;
    
    let debounceTimeout: NodeJS.Timeout;
    let lastUpdateTime = 0;
    
    const unsubscribe = subjectTracker.subscribe(() => {
      const now = Date.now();
      
      // Clear previous debounce timeout
      clearTimeout(debounceTimeout);
      
      // If it's been less than 2 seconds since last update, debounce more aggressively
      const debounceDelay = (now - lastUpdateTime < 2000) ? 1500 : 500;
      
      debounceTimeout = setTimeout(async () => {
        lastUpdateTime = Date.now();
        
        try {
          // Get fresh subject tracker topics and combine with cached server topics
          const subjectTrackerTopics = subjectTracker.getSubjects().map(s => s.subject);
          const serverTopicsSet = serverTopicsCache.current.topics;
          const allTopicsSet = new Set([...serverTopicsSet, ...subjectTrackerTopics]);
          const newTopics = Array.from(allTopicsSet).sort();
          const newHash = createTopicsHash(newTopics);
          
          if (newHash !== lastTopicsHash.current) {
            lastTopicsHash.current = newHash;
            setTopics(newTopics);
          }
        } catch (error) {
          console.error('Failed to update subject tracker topics:', error);
        }
      }, debounceDelay);
    });
    
    return () => {
      clearTimeout(debounceTimeout);
      unsubscribe();
    };
  }, [isConnected, createTopicsHash]);


  if (!isConnected) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Messages</h1>
            <p className="text-muted-foreground">
              Connect to NATS server to publish and subscribe to messages
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
    <div className="h-full flex flex-col p-4">
      <div className="flex items-center justify-between mb-6 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-bold">Topics</h1>
          <p className="text-muted-foreground">
            Browse subjects, view messages, and publish to topics
          </p>
        </div>
      </div>

      <div className="flex-1 lg:grid lg:grid-cols-3 gap-6 lg:min-h-0 lg:max-h-[calc(100vh-10rem)]">
        {/* Topics List */}
        <div className="lg:col-span-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  Topics ({topicListData.length})
                </div>
                <div className="flex gap-1">
                  <Button
                    variant={hideInboxTopics ? "outline" : "default"}
                    size="sm"
                    onClick={() => setHideInboxTopics(!hideInboxTopics)}
                    title={hideInboxTopics ? "Show _INBOX topics" : "Hide _INBOX topics"}
                  >
                    {hideInboxTopics ? <MailX className="h-4 w-4" /> : <Inbox className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        setIsLoadingTopics(true);
                        // Force fresh fetch from NATS server
                        const freshServerTopics = await fetchActiveSubjects();
                        const subjectTrackerTopics = subjectTracker.getSubjects().map(s => s.subject);

                        // Combine and update
                        const allTopicsSet = new Set([...freshServerTopics, ...subjectTrackerTopics]);
                        const newTopics = Array.from(allTopicsSet).sort();
                        setTopics(newTopics);

                        toast.success('Topics refreshed from NATS server');
                      } catch (error) {
                        console.error('Failed to refresh topics:', error);
                        toast.error('Failed to refresh topics from server');
                      } finally {
                        setIsLoadingTopics(false);
                      }
                    }}
                    disabled={isLoadingTopics}
                    title="Refresh topics from NATS server"
                  >
                    <RefreshCw className={`h-4 w-4 ${isLoadingTopics ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsAddTopicOpen(true);
                      setNewTopicName('');
                    }}
                    title="Add custom topic"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden px-6 relative">
              <div className="h-full overflow-y-auto">
                {TopicListMemoized}
              </div>
              {/* Bottom fade effect */}
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background to-transparent pointer-events-none" />
            </CardContent>
          </Card>
        </div>

        {/* Topic Details and Actions */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          {!selectedTopic ? (
            <Card className="flex-1 flex flex-col">
              <CardContent className="flex-1 flex items-center justify-center p-8">
                <div className="text-center space-y-4">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-center">Select a Topic</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm mx-auto leading-relaxed">
                      Choose a topic from the list to view messages and publish
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex-1 flex flex-col gap-6 min-h-0">
              {/* Publish to Topic - Collapsible */}
              <Collapsible 
                open={isPublishExpanded} 
                onOpenChange={setIsPublishExpanded}
                className="flex-shrink-0"
              >
                <Card className={cn("overflow-hidden pt-0 gap-2", !isPublishExpanded && 'pb-0')}>
                  <CollapsibleTrigger asChild>
                    <div className="cursor-pointer hover:bg-muted/50 transition-colors p-6 pb-4">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Send className="h-5 w-5" />
                          <span className="text-lg font-semibold">Publish to {selectedTopic}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {!isPublishExpanded && (
                            <Badge variant="secondary" className="text-xs">
                              Click to expand
                            </Badge>
                          )}
                          {isPublishExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      {!isPublishExpanded && (
                        <p className="text-sm text-muted-foreground">
                          Send messages to this topic
                        </p>
                      )}
                    </div>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <CardContent>
                      <form
                        onSubmit={publishForm.handleSubmit(async (data) => {
                          await handlePublish({ ...data, subject: selectedTopic });
                        })}
                        className="space-y-4"
                        autoComplete="off"
                        data-form-type="other"
                      >
                        <div className="space-y-2">
                          <Label htmlFor="publish-data">Message Data</Label>
                          <Textarea
                            id="publish-data"
                            placeholder="Enter message content..."
                            rows={3}
                            {...publishForm.register('data')}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="publish-headers">Headers (JSON, optional)</Label>
                          <Textarea
                            id="publish-headers"
                            placeholder='{"Content-Type": "application/json"}'
                            rows={2}
                            {...publishForm.register('headers')}
                          />
                        </div>

                        <Button
                          type="submit"
                          disabled={publishForm.formState.isSubmitting}
                          className="w-full"
                        >
                          <Send className="mr-2 h-4 w-4" />
                          Publish Message
                        </Button>
                      </form>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              {/* Messages Display - Takes remaining space */}
              <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <CardHeader className="flex-shrink-0 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Messages for {selectedTopic} ({filteredMessages.length})
                    </CardTitle>
                    <CardDescription>
                      Messages received from this topic
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const exportData = filteredMessages.map(msg => ({
                          subject: msg.subject,
                          data: msg.data,
                          headers: msg.headers,
                          timestamp: msg.timestamp.toISOString(),
                          replyTo: msg.replyTo,
                        }));
                        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                          type: 'application/json',
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `nats-${selectedTopic}-${new Date().toISOString().split('T')[0]}.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                        toast.success('Messages exported successfully');
                      }}
                      disabled={filteredMessages.length === 0}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMessages(prev => prev.filter(m => m.subject !== selectedTopic));
                        toast.success('Messages cleared');
                      }}
                      disabled={filteredMessages.length === 0}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const isSubscribed = subscriptions.some(s => s.subject === selectedTopic && s.isActive);
                        if (isSubscribed) {
                          const sub = subscriptions.find(s => s.subject === selectedTopic && s.isActive);
                          if (sub) handleUnsubscribe(sub.id);
                        } else {
                          if (selectedTopic) {
                            handleSubscribe({ subject: selectedTopic, queueGroup: '' });
                          }
                        }
                      }}
                      className="flex items-center justify-center"
                    >
                      {subscriptions.some(s => s.subject === selectedTopic && s.isActive) ? (
                        <Square className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden px-6">
                  <div className="h-full overflow-y-auto">
                    {filteredMessages.length === 0 ? (
                      <div className="flex items-center justify-center h-full min-h-[400px] pb-12">
                        <div className="text-center space-y-6">
                          <div className="space-y-4">
                            <MessageSquare className="h-16 w-16 mx-auto text-muted-foreground" />
                            <div className="space-y-3">
                              <h3 className="text-lg font-semibold text-center">No messages yet</h3>
                              <p className="text-sm text-muted-foreground text-center max-w-sm mx-auto leading-relaxed">
                                {subscriptions.some(s => s.subject === selectedTopic && s.isActive) 
                                  ? "Waiting for messages on this topic..."
                                  : "Subscribe to this topic to start receiving messages"}
                              </p>
                            </div>
                          </div>
                          {subscriptions.some(s => s.subject === selectedTopic && s.isActive) ? (
                            <Button
                              variant="outline"
                              onClick={() => {
                                const sub = subscriptions.find(s => s.subject === selectedTopic && s.isActive);
                                if (sub) handleUnsubscribe(sub.id);
                              }}
                              className="mx-auto"
                              size="lg"
                            >
                              <Square className="mr-2 h-4 w-4" />
                              Unsubscribe
                            </Button>
                          ) : (
                            <Button
                              onClick={() => {
                                if (selectedTopic) {
                                  handleSubscribe({ subject: selectedTopic, queueGroup: '' });
                                }
                              }}
                              className="mx-auto"
                              size="lg"
                            >
                              <Play className="mr-2 h-4 w-4" />
                              Subscribe
                            </Button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredMessages.map((message) => (
                          <MessageItem
                            key={message.id}
                            message={message}
                            isHeaderExpanded={expandedHeaders.has(message.id)}
                            onToggleHeader={toggleHeaderExpansion}
                            onCopyBody={copyMessageBody}
                            onCopyHeaders={copyMessageHeaders}
                            onCopyAll={copyMessageAll}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Add Topic Modal */}
      <Dialog open={isAddTopicOpen} onOpenChange={setIsAddTopicOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Custom Topic</DialogTitle>
            <DialogDescription>
              Enter a topic name to add it to the list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="topic-name">Topic Name</Label>
              <Input
                id="topic-name"
                placeholder="e.g., orders.created"
                value={newTopicName}
                onChange={(e) => setNewTopicName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newTopicName.trim()) {
                    setTopics(prev => [...new Set([...prev, newTopicName.trim()])].sort());
                    setSelectedTopic(newTopicName.trim());
                    setIsAddTopicOpen(false);
                    setNewTopicName('');
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddTopicOpen(false);
                setNewTopicName('');
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (newTopicName.trim()) {
                  setTopics(prev => [...new Set([...prev, newTopicName.trim()])].sort());
                  setSelectedTopic(newTopicName.trim());
                  setIsAddTopicOpen(false);
                  setNewTopicName('');
                }
              }}
              disabled={!newTopicName.trim()}
            >
              Add Topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const Messages = memo(MessagesComponent);