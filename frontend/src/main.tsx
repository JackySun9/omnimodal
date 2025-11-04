import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';

import { router } from './routes';
import './styles.css';

import { ErrorHandler } from './utils/errorHandler';

// Create a client for React Query with global error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
      onError: (error) => {
        const errorMsg = ErrorHandler.handleApiError(error);
        ErrorHandler.showError(errorMsg);
      },
    },
    mutations: {
      onError: (error) => {
        const errorMsg = ErrorHandler.handleApiError(error);
        ErrorHandler.showError(errorMsg);
      },
    },
  },
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            padding: '0.75rem 1rem',
          },
          success: {
            iconTheme: {
              primary: 'var(--success)',
              secondary: 'white',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--error)',
              secondary: 'white',
            },
          },
          loading: {
            iconTheme: {
              primary: 'var(--info)',
              secondary: 'transparent',
            },
          },
        }}
      />
    </QueryClientProvider>
  </React.StrictMode>
);
