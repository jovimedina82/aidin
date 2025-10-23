'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/components/AuthProvider'

export function useStats() {
  const { makeAuthenticatedRequest } = useAuth()

  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const response = await makeAuthenticatedRequest('/api/stats')
      if (!response.ok) throw new Error('Failed to fetch stats')
      return response.json()
    },
    staleTime: 3 * 60 * 1000, // Stats are fresh for 3 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refetch every 5 minutes
    enabled: !!makeAuthenticatedRequest,
  })
}
