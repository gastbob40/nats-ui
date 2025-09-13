import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';

import { NatsProvider } from './contexts/NatsContext';
import { MainLayout } from './components/layout/MainLayout';

// Pages
import Dashboard from './pages/Dashboard';
import { Messages } from './pages/Messages';
import { Streams } from './pages/Streams';
import { Consumers } from './pages/Consumers';
import { KVStore } from './pages/KVStore';
import { Monitoring } from './pages/Monitoring';
import { Settings } from './pages/Settings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

// Get the base path from Vite's base configuration
const basename = import.meta.env.BASE_URL;

function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <NatsProvider>
          <Router basename={basename}>
            <div className="min-h-screen bg-background text-foreground">
              <Routes>
                <Route path="/" element={<MainLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="streams" element={<Streams />} />
                  <Route path="consumers" element={<Consumers />} />
                  <Route path="kv-store" element={<KVStore />} />
                  <Route path="monitoring" element={<Monitoring />} />
                  <Route path="settings" element={<Settings />} />
                </Route>
              </Routes>
            </div>
          </Router>
          <Toaster 
            position="top-right" 
            expand={true} 
            richColors 
            closeButton 
          />
        </NatsProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
