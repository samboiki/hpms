import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import App from './App';
import InstallAppBanner from './pwa/InstallAppBanner';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import { initNativeApp } from './native/nativeApp';
import './index.css';
import './styles/mobile-appointment-fix.css';

// The 5-minute cache and its defaults live in lib/queryClient.ts (saves refresh what they change through it)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <App />
        <InstallAppBanner />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);

registerServiceWorker();
initNativeApp(); // Android and iOS store apps only