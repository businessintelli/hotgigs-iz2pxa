import React, { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // ^4.0.0

// Internal imports
import AppRoutes from './routes';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import { WebSocketProvider } from './contexts/WebSocketContext';

// Error fallback component for the top-level error boundary
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div className="flex flex-col items-center justify-center min-h-screen text-red-600">
    <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
    <p>{error.message}</p>
    <button
      className="mt-4 px-4 py-2 bg-red-100 text-red-800 rounded hover:bg-red-200"
      onClick={() => window.location.reload()}
    >
      Reload Application
    </button>
  </div>
);

// Loading fallback for code-split components
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
  </div>
);

// Configure the query client with production-ready settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      suspense: true,
    },
    mutations: {
      retry: 2,
      onError: (error) => {
        console.error('Mutation error:', error);
      },
    },
  },
});

/**
 * Root application component that provides global context providers,
 * error boundaries, and routing configuration for the HotGigs platform.
 */
const App: React.FC = () => {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onError={(error) => {
        // Log errors in production
        if (process.env.NODE_ENV === 'production') {
          console.error('Application error:', error);
        }
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <WebSocketProvider>
              <ToastProvider
                position="top-right"
                maxVisible={5}
                pauseOnHover={true}
              >
                <Suspense fallback={<LoadingFallback />}>
                  <AppRoutes />
                </Suspense>
              </ToastProvider>
            </WebSocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;