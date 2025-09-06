import { Outlet, Link, useLocation } from 'react-router-dom';
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
  const [httpStatus, setHttpStatus] = useState<'checking' | 'available' | 'error' | 'unconfigured'>('unconfigured');

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
    if (natsConfig.httpUrl) {
      checkHttpStatus(natsConfig.httpUrl);
    } else {
      setHttpStatus('unconfigured');
    }
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
                      className={`h-2 w-2 rounded-full ${getStatusColor(status)}`}
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
                          <Link to={item.path}>
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
                v1.0.0
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleTheme}
                className="h-8 w-8"
                title={getThemeTooltip()}
              >
                {getThemeIcon()}
                <span className="sr-only">Cycle theme</span>
              </Button>
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
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}