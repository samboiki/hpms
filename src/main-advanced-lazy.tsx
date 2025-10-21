import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './styles/mobile-appointment-fix.css';

// Advanced lazy loading with complete React Query deferral
function AdvancedLazyApp() {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [AppComponent, setAppComponent] = React.useState<React.ComponentType | null>(null);

  React.useEffect(() => {
    // Defer React Query loading completely until after component mount
    const loadAppWithQuery = async () => {
      try {
        // Load React Query and App in separate chunks
        const [reactQueryModule, appModule] = await Promise.all([
          import('@tanstack/react-query'),
          import('./App')
        ]);

        const { QueryClient, QueryClientProvider } = reactQueryModule;
        const { default: App } = appModule;

        const queryClient = new QueryClient({
          defaultOptions: {
            queries: {
              staleTime: 1000 * 60 * 5, // 5 minutes
              refetchOnWindowFocus: true,
              retry: 1,
            },
          },
        });

        const AppWithQuery = () => (
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        );

        setAppComponent(() => AppWithQuery);
        setIsLoaded(true);
      } catch (error) {
        console.error('Failed to load app:', error);
        setIsLoaded(true); // Set to true to show error state
      }
    };

    // Use setTimeout to ensure this happens after the initial render cycle
    const timeoutId = setTimeout(loadAppWithQuery, 0);
    return () => clearTimeout(timeoutId);
  }, []);

  if (!isLoaded || !AppComponent) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f3f4f6',
        fontFamily: 'Poppins, sans-serif'
      }}>
        <div>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #3b82f6',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }}></div>
          </div>
          <div>Loading Healthcare Practice Management...</div>
          <style dangerouslySetInnerHTML={{
            __html: `
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `
          }} />
        </div>
      </div>
    );
  }

  return <AppComponent />;
}

// Import React after the component definition to avoid issues
import React from 'react';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <AdvancedLazyApp />
    </BrowserRouter>
  </StrictMode>
);