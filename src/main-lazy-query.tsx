import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './styles/mobile-appointment-fix.css';

// Lazy load the App with React Query to avoid circular dependency during initial load
const AppWithQuery = lazy(async () => {
  const [
    { QueryClient, QueryClientProvider },
    { default: App }
  ] = await Promise.all([
    import('@tanstack/react-query'),
    import('./App')
  ]);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });

  return {
    default: () => (
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    )
  };
});

function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      backgroundColor: '#f3f4f6',
      fontFamily: 'Poppins, sans-serif'
    }}>
      <div>Loading Healthcare Practice Management...</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <Suspense fallback={<LoadingFallback />}>
        <AppWithQuery />
      </Suspense>
    </BrowserRouter>
  </StrictMode>
);