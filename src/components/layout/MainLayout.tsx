import { Outlet, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useTheme } from 'next-themes';
import {
  Database,
  Home,
  MessageSquare,
  Settings,
  GitBranch,
  Users,
  Moon,
  Sun,
  Monitor,
} from 'lucide-react';
import { pageEnter, swapSpring, easings } from '@/lib/animations';

// GitHub brand icon (removed from lucide-react v1)
function Github({ className }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '../ui/sidebar';
import { Button } from '../ui/button';
import { useNats } from '../../hooks/useNats';
import { Badge } from '../ui/badge';
import { useState, useCallback, useEffect } from 'react';

const navigationItems = [
  {
    title: 'Dashboard',
    path: '/',
    icon: Home,
  },
  {
    title: 'Messages',
    path: '/messages',
    icon: MessageSquare,
  },
  {
    title: 'Streams',
    path: '/streams',
    icon: GitBranch,
  },
  {
    title: 'Consumers',
    path: '/consumers',
    icon: Users,
  },
  {
    title: 'KV Store',
    path: '/kv-store',
    icon: Database,
  },
  {
    title: 'Settings',
    path: '/settings',
    icon: Settings,
  },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case 'connected':
      return 'bg-green-500';
    case 'connecting':
      return 'bg-yellow-500';
    case 'disconnected':
      return 'bg-gray-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
};

const getStatusText = (status: string) => {
  switch (status) {
    case 'connected':
      return 'Connected';
    case 'connecting':
      return 'Connecting';
    case 'disconnected':
      return 'Disconnected';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
};

export function MainLayout() {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { status, config: natsConfig } = useNats();
  const [rawHttpStatus, setHttpStatus] = useState<'checking' | 'available' | 'error' | 'unconfigured'>('unconfigured');
  // When there is no HTTP URL configured, the status is purely derived.
  const httpStatus = natsConfig.httpUrl ? rawHttpStatus : 'unconfigured';

  const checkHttpStatus = useCallback(async (httpUrl: string) => {
    if (!httpUrl) {
      setHttpStatus('unconfigured');
      return;
    }

    setHttpStatus('checking');
    try {
      const testUrl = httpUrl.endsWith('/') ? `${httpUrl}varz` : `${httpUrl}/varz`;
      const response = await fetch(testUrl, { method: 'GET' });
      setHttpStatus(response.ok ? 'available' : 'error');
    } catch {
      setHttpStatus('error');
    }
  }, []);

  useEffect(() => {
    const httpUrl = natsConfig.httpUrl;
    if (!httpUrl) return;
    const run = async () => { await checkHttpStatus(httpUrl); };
    run();
  }, [natsConfig.httpUrl, checkHttpStatus]);

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system'); 
    else setTheme('light'); // system → light
  };

  const getThemeIcon = () => {
    if (theme === 'light') return <Sun className="h-4 w-4" />;
    if (theme === 'dark') return <Moon className="h-4 w-4" />;
    return <Monitor className="h-4 w-4" />; // system
  };

  const getThemeTooltip = () => {
    if (theme === 'light') return 'Switch to dark mode';
    if (theme === 'dark') return 'Switch to system mode';
    return 'Switch to light mode'; // system
  };

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <Sidebar variant="inset" collapsible="icon">
          <SidebarHeader className="border-b border-sidebar-border">
            <div className="flex items-center gap-2 px-4 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary p-2">
                  <Database className="h-4 w-4 text-primary-foreground" />
                </div>
                <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                  <h1 className="text-sm font-semibold">NATS UI</h1>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${getStatusColor(status)} ${
                        status === 'connected' ? 'status-pulse' : ''
                      }`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {getStatusText(status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                        >
                          <Link to={item.path} className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="border-t border-sidebar-border">
            <div className="flex items-center justify-between p-2 group-data-[collapsible=icon]:justify-center">
              <Badge variant="outline" className="text-xs group-data-[collapsible=icon]:hidden">
                v{__APP_VERSION__}
              </Badge>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => window.open('https://github.com/gastbob40/nats-ui', '_blank')}
                  className="h-8 w-8"
                  title="View on GitHub"
                >
                  <Github className="h-4 w-4" />
                  <span className="sr-only">View on GitHub</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={cycleTheme}
                  className="h-8 w-8"
                  title={getThemeTooltip()}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={theme}
                      initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
                      animate={{ opacity: 1, rotate: 0, scale: 1 }}
                      exit={{
                        opacity: 0,
                        rotate: 90,
                        scale: 0.8,
                        transition: { duration: 0.12, ease: easings.easeOut },
                      }}
                      transition={swapSpring}
                      className="flex items-center justify-center"
                    >
                      {getThemeIcon()}
                    </motion.span>
                  </AnimatePresence>
                  <span className="sr-only">Cycle theme</span>
                </Button>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <SidebarInset className="flex flex-1 flex-col overflow-hidden">
          <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
            <SidebarTrigger className="-ml-1" />
            <div className="flex flex-1 items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">
                  {navigationItems.find(item => item.path === location.pathname)?.title || 'NATS UI'}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {/* WebSocket Status Badge */}
                <Badge 
                  variant={
                    status === 'connected' ? 'default' : 
                    status === 'connecting' ? 'secondary' :
                    status === 'error' ? 'destructive' : 
                    'outline'
                  }
                  className={`text-xs ${
                    status === 'connected' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''
                  }`}
                >
                  WS: {status === 'connected' ? 'Connected' : 
                       status === 'connecting' ? 'Connecting' :
                       status === 'error' ? 'Error' : 'Disconnected'}
                </Badge>

                {/* HTTP API Status Badge */}
                {natsConfig.httpUrl && (
                  <Badge 
                    variant={
                      httpStatus === 'available' ? 'default' : 
                      httpStatus === 'checking' ? 'secondary' :
                      httpStatus === 'error' ? 'destructive' : 
                      'outline'
                    }
                    className={`text-xs ${
                      httpStatus === 'available' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' : ''
                    }`}
                  >
                    HTTP: {httpStatus === 'available' ? 'Available' : 
                           httpStatus === 'checking' ? 'Checking' :
                           httpStatus === 'error' ? 'Error' : 'Unknown'}
                  </Badge>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4">
            <motion.div
              key={location.pathname}
              variants={pageEnter}
              initial="hidden"
              animate="visible"
              className="h-full"
            >
              <Outlet />
            </motion.div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}