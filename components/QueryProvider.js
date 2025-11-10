'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'

export function QueryProvider({ children }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Aggressive caching for better performance
        staleTime: 5 * 60 * 1000, // Data is fresh for 5 minutes
        cacheTime: 10 * 60 * 1000, // Keep unused data in cache for 10 minutes
        refetchOnWindowFocus: false, // Don't refetch when window regains focus
        refetchOnMount: false, // Don't refetch on mount if data exists
        refetchOnReconnect: true, // Refetch on reconnect
        retry: 1, // Retry failed requests once
        // Keep previous data while fetching new data (no loading flash)
        keepPreviousData: true,
      },
      mutations: {
        // Auto-retry mutations once on failure
        retry: 1,
      },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
