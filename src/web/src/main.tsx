import React from 'react'; // ^18.0.0
import ReactDOM from 'react-dom/client'; // ^18.0.0
import * as Sentry from '@sentry/react'; // ^7.0.0
import { datadogRum } from '@datadog/browser-rum'; // ^4.0.0
import { ErrorBoundary } from '@sentry/react'; // ^7.0.0

import App from './App';
import './styles/globals.css';

/**
 * Initializes monitoring and error tracking services based on environment
 */
function initializeMonitoring(): void {
  // Validate required environment variables
  const requiredVars = [
    'VITE_SENTRY_DSN',
    'VITE_DATADOG_APP_ID',
    'VITE_DATADOG_CLIENT_TOKEN'
  ];

  requiredVars.forEach(varName => {
    if (!import.meta.env[varName]) {
      throw new Error(`Missing required environment variable: ${varName}`);
    }
  });

  // Initialize Sentry for error tracking
  if (import.meta.env.MODE === 'production') {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE,
      tracesSampleRate: 1.0,
      integrations: [
        new Sentry.BrowserTracing(),
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true
        })
      ]
    });
  }

  // Initialize DataDog RUM for performance monitoring
  datadogRum.init({
    applicationId: import.meta.env.VITE_DATADOG_APP_ID,
    clientToken: import.meta.env.VITE_DATADOG_CLIENT_TOKEN,
    site: 'datadoghq.com',
    service: 'hotgigs-web',
    env: import.meta.env.MODE,
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 20,
    trackUserInteractions: true,
    trackResources: true,
    trackLongTasks: true,
    defaultPrivacyLevel: 'mask-user-input'
  });
}

/**
 * Error fallback component for the top-level error boundary
 */
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

/**
 * Initialize the application with monitoring and render the root component
 */
function main(): void {
  try {
    // Initialize monitoring services
    initializeMonitoring();

    // Get root element
    const rootElement = document.getElementById('root');
    if (!rootElement) {
      throw new Error('Root element not found');
    }

    // Create React root and render app
    ReactDOM.createRoot(rootElement).render(
      <React.StrictMode>
        <ErrorBoundary
          fallback={ErrorFallback}
          onError={(error) => {
            if (import.meta.env.MODE === 'production') {
              Sentry.captureException(error);
            }
          }}
        >
          <App />
        </ErrorBoundary>
      </React.StrictMode>
    );

    // Log successful initialization in development
    if (import.meta.env.MODE === 'development') {
      console.log('HotGigs application initialized successfully');
    }
  } catch (error) {
    // Log initialization errors and show error UI
    console.error('Failed to initialize application:', error);
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;color:#dc2626;text-align:center;padding:1rem;">
        <h1 style="font-size:1.5rem;font-weight:600;margin-bottom:0.5rem;">Application Initialization Failed</h1>
        <p>${error instanceof Error ? error.message : 'An unknown error occurred'}</p>
      </div>
    `;
  }
}

// Start the application
main();