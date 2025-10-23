'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/components/AuthProvider'

// Query key factory for better organization
export const ticketsKeys = {
  all: ['tickets'],
  lists: () => [...ticketsKeys.all, 'list'],
  list: (filters) => [...ticketsKeys.lists(), filters],
  details: () => [...ticketsKeys.all, 'detail'],
  detail: (id) => [...ticketsKeys.details(), id],
}

// Hook to fetch tickets with filters
export function useTickets(filters = {}) {
  const { makeAuthenticatedRequest } = useAuth()

  return useQuery({
    queryKey: ticketsKeys.list(filters),
    queryFn: async () => {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v))
          } else {
            params.append(key, value)
          }
        }
      })

      const response = await makeAuthenticatedRequest(`/api/tickets?${params}`)
      if (!response.ok) throw new Error('Failed to fetch tickets')
      return response.json()
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - tickets change frequently
    enabled: !!makeAuthenticatedRequest, // Only run when auth is ready
  })
}

// Hook to fetch a single ticket
export function useTicket(ticketId) {
  const { makeAuthenticatedRequest } = useAuth()

  return useQuery({
    queryKey: ticketsKeys.detail(ticketId),
    queryFn: async () => {
      const response = await makeAuthenticatedRequest(`/api/tickets/${ticketId}`)
      if (!response.ok) throw new Error('Failed to fetch ticket')
      return response.json()
    },
    enabled: !!ticketId && !!makeAuthenticatedRequest,
    staleTime: 1 * 60 * 1000, // 1 minute for individual tickets
  })
}

// Hook to create a ticket
export function useCreateTicket() {
  const { makeAuthenticatedRequest } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ticketData) => {
      const response = await makeAuthenticatedRequest('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData),
      })
      if (!response.ok) throw new Error('Failed to create ticket')
      return response.json()
    },
    onSuccess: () => {
      // Invalidate all ticket lists to refetch
      queryClient.invalidateQueries({ queryKey: ticketsKeys.lists() })
      // Also invalidate stats
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

// Hook to update a ticket
export function useUpdateTicket(ticketId) {
  const { makeAuthenticatedRequest } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (updates) => {
      const response = await makeAuthenticatedRequest(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Failed to update ticket')
      return response.json()
    },
    onSuccess: (data) => {
      // Update the specific ticket in cache
      queryClient.setQueryData(ticketsKeys.detail(ticketId), data)
      // Invalidate ticket lists
      queryClient.invalidateQueries({ queryKey: ticketsKeys.lists() })
      // Invalidate stats
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}

// Hook to delete a ticket
export function useDeleteTicket() {
  const { makeAuthenticatedRequest } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ticketId) => {
      const response = await makeAuthenticatedRequest(`/api/tickets/${ticketId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete ticket')
      return response.json()
    },
    onSuccess: () => {
      // Invalidate all ticket queries
      queryClient.invalidateQueries({ queryKey: ticketsKeys.all })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
