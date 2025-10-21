import React, { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import './styles/mobile-appointment-fix.css';

// Create a single QueryClient instance outside of the component
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data considered fresh for 5 min
      gcTime: 1000 * 60 * 10, // 10 minutes - keep unused data in cache for 10 min
      refetchOnWindowFocus: false, // Disabled to reduce unnecessary refetches
      refetchOnReconnect: false, // Disabled to reduce unnecessary refetches
      refetchOnMount: false, // Don't refetch when component mounts if data is fresh
      retry: 1, // Only retry once on failure
      // Enable query deduplication - multiple components requesting same data get same result
      structuralSharing: true,
      // Network mode to prevent duplicate requests
      networkMode: 'online',
    },
  },
});

createRoot(document.getElementById('root')!).render(
  // StrictMode removed to prevent duplicate queries in development
  // Re-enable for production builds
  <QueryClientProvider client={queryClient}>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <App />
    </BrowserRouter>
  </QueryClientProvider>
);