'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/components/AuthProvider'

export function useUserPreferences() {
  const { makeAuthenticatedRequest } = useAuth()

  return useQuery({
    queryKey: ['userPreferences'],
    queryFn: async () => {
      const response = await makeAuthenticatedRequest('/api/user-preferences')
      if (!response.ok) throw new Error('Failed to fetch preferences')
      return response.json()
    },
    staleTime: 10 * 60 * 1000, // Preferences rarely change, cache for 10 minutes
    enabled: !!makeAuthenticatedRequest,
  })
}

export function useUpdateUserPreferences() {
  const { makeAuthenticatedRequest } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (preferences) => {
      const response = await makeAuthenticatedRequest('/api/user-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      })
      if (!response.ok) throw new Error('Failed to update preferences')
      return response.json()
    },
    onMutate: async (newPreferences) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['userPreferences'] })

      // Snapshot the previous value
      const previousPreferences = queryClient.getQueryData(['userPreferences'])

      // Optimistically update to the new value
      queryClient.setQueryData(['userPreferences'], (old) => ({
        ...old,
        ...newPreferences,
      }))

      // Return context with the previous value
      return { previousPreferences }
    },
    onError: (err, newPreferences, context) => {
      // Rollback to the previous value on error
      queryClient.setQueryData(['userPreferences'], context.previousPreferences)
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['userPreferences'] })
    },
  })
}
