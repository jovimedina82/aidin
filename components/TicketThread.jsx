'use client'
import { useState, useEffect, useRef } from 'react'
import { GitMerge, X, ExternalLink, ChevronRight, MessageSquare, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from './AuthProvider'
import { toast } from 'sonner'
import Link from 'next/link'

export default function TicketThread({ ticket, onUpdate }) {
  const { makeAuthenticatedRequest } = useAuth()
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTicketIds, setSelectedTicketIds] = useState([]) // Array of ticket IDs to merge
  const [merging, setMerging] = useState(false)
  const [availableTickets, setAvailableTickets] = useState([])
  const [filteredTickets, setFilteredTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  const hasThread = ticket.parentTicket || (ticket.childTickets && ticket.childTickets.length > 0)

  // Load available tickets when dialog opens
  useEffect(() => {
    if (showMergeDialog && availableTickets.length === 0) {
      loadAvailableTickets()
    }
  }, [showMergeDialog])

  // Filter tickets based on search input
  useEffect(() => {
    if (searchQuery.trim()) {
      const searchLower = searchQuery.toLowerCase()
      const filtered = availableTickets.filter(t => {
        const ticketNumberMatch = t.ticketNumber?.toLowerCase().includes(searchLower)
        const titleMatch = t.title?.toLowerCase().includes(searchLower)
        const requesterMatch = `${t.requester?.firstName} ${t.requester?.lastName}`.toLowerCase().includes(searchLower)
        return ticketNumberMatch || titleMatch || requesterMatch
      })
      setFilteredTickets(filtered)
    } else {
      // Show all available tickets when no search
      setFilteredTickets(availableTickets)
    }
  }, [searchQuery, availableTickets])

  // Load available tickets (excluding current ticket)
  const loadAvailableTickets = async () => {
    setLoadingTickets(true)
    try {
      const response = await makeAuthenticatedRequest('/api/tickets?limit=200')
      if (response.ok) {
        const data = await response.json()
        // Exclude current ticket, already linked tickets, and CLOSED tickets
        const tickets = (data.tickets || []).filter(t =>
          t.id !== ticket.id &&
          t.id !== ticket.parentTicketId &&
          t.status !== 'CLOSED' &&
          t.status !== 'SOLVED' &&
          !ticket.childTickets?.some(child => child.id === t.id)
        )
        setAvailableTickets(tickets)
        setFilteredTickets(tickets)
      }
    } catch (error) {
      // console.error('Failed to load tickets:', error)
      toast.error('Failed to load available tickets')
    } finally {
      setLoadingTickets(false)
    }
  }

  const handleToggleTicket = (ticketId) => {
    setSelectedTicketIds(prev => {
      if (prev.includes(ticketId)) {
        return prev.filter(id => id !== ticketId)
      } else {
        return [...prev, ticketId]
      }
    })
  }

  const handleSelectAll = () => {
    if (selectedTicketIds.length === filteredTickets.length) {
      setSelectedTicketIds([])
    } else {
      setSelectedTicketIds(filteredTickets.map(t => t.id))
    }
  }

  // Merge selected tickets into this ticket
  const handleMergeTickets = async () => {
    if (selectedTicketIds.length === 0) {
      toast.error('Please select at least one ticket to merge')
      return
    }

    const confirmMessage = `Merge ${selectedTicketIds.length} ticket(s) into ${ticket.ticketNumber}? This will:\n\n• Copy all comments and attachments\n• Delete the merged tickets\n• This action cannot be undone`

    if (!confirm(confirmMessage)) {
      return
    }

    setMerging(true)
    try {
      const response = await makeAuthenticatedRequest('/api/tickets/merge', {
        method: 'POST',
        body: JSON.stringify({
          primaryTicketId: ticket.id,
          ticketIdsToMerge: selectedTicketIds
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to merge tickets')
      }

      const result = await response.json()
      toast.success(result.message || 'Tickets merged successfully')

      setShowMergeDialog(false)
      setSelectedTicketIds([])
      setSearchQuery('')
      setAvailableTickets([])

      if (onUpdate) onUpdate()
    } catch (error) {
      // console.error('Merge error:', error)
      toast.error(error.message || 'Failed to merge tickets')
    } finally {
      setMerging(false)
    }
  }

  // Unlink from parent
  const handleUnlink = async () => {
    if (!confirm('Unlink this ticket from its parent?')) return

    try {
      const response = await makeAuthenticatedRequest(`/api/tickets/${ticket.id}/link`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to unlink ticket')
      }

      toast.success('Ticket unlinked')
      if (onUpdate) onUpdate()
    } catch (error) {
      // console.error('Unlink error:', error)
      toast.error(error.message || 'Failed to unlink ticket')
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      NEW: 'bg-blue-100 text-blue-800',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
      PENDING: 'bg-purple-100 text-purple-800',
      RESOLVED: 'bg-green-100 text-green-800',
      CLOSED: 'bg-gray-100 text-gray-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-4">
      {/* Header with Merge Button */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Related Tickets
        </h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setShowMergeDialog(!showMergeDialog)}
        >
          <GitMerge className="w-4 h-4 mr-1" />
          Merge Tickets
        </Button>
      </div>

      {/* Merge Dialog */}
      {showMergeDialog && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-gray-700">
              Select tickets to merge into {ticket.ticketNumber}
            </label>
            <button
              onClick={() => {
                setShowMergeDialog(false)
                setSelectedTicketIds([])
                setSearchQuery('')
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search box */}
          <div className="mb-3">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                placeholder="Search tickets by number, title, or requester..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2 pr-8 border border-gray-300 rounded-md text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                disabled={merging}
                autoComplete="off"
              />
              <Search className="absolute right-3 top-2.5 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Ticket list with checkboxes */}
          <div className="space-y-2">
            {loadingTickets ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                <div className="animate-pulse">Loading tickets...</div>
              </div>
            ) : filteredTickets.length > 0 ? (
              <>
                {/* Select all checkbox */}
                <div className="flex items-center gap-2 pb-2 border-b">
                  <input
                    type="checkbox"
                    id="select-all"
                    checked={selectedTicketIds.length === filteredTickets.length && filteredTickets.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="select-all" className="text-sm text-gray-600 cursor-pointer">
                    Select all ({filteredTickets.length} tickets)
                  </label>
                </div>

                {/* Ticket list */}
                <div className="max-h-96 overflow-y-auto space-y-1">
                  {filteredTickets.map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-start gap-2 p-2 rounded hover:bg-blue-100 transition-colors ${
                        selectedTicketIds.includes(t.id) ? 'bg-blue-100' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        id={`ticket-${t.id}`}
                        checked={selectedTicketIds.includes(t.id)}
                        onChange={() => handleToggleTicket(t.id)}
                        className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`ticket-${t.id}`} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm font-medium text-gray-900">
                            {t.ticketNumber}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${getStatusColor(t.status)}`}>
                            {t.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 line-clamp-2">
                          {t.title}
                        </p>
                        {t.requester && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {t.requester.firstName} {t.requester.lastName}
                          </p>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-3 text-sm text-gray-500 text-center">
                {searchQuery.trim()
                  ? `No tickets found matching "${searchQuery}"`
                  : availableTickets.length === 0
                    ? 'No available tickets to merge'
                    : 'No tickets available'}
              </div>
            )}

            {/* Merge button */}
            <div className="pt-3 border-t">
              <Button
                type="button"
                onClick={handleMergeTickets}
                disabled={merging || selectedTicketIds.length === 0}
                className="w-full"
              >
                {merging
                  ? 'Merging...'
                  : `Merge ${selectedTicketIds.length} ticket(s) into ${ticket.ticketNumber}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* No Thread */}
      {!hasThread && !showMergeDialog && (
        <div className="text-center py-6 text-gray-500 text-sm">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p>No related tickets</p>
          <p className="text-xs">Merge related tickets to combine their history</p>
        </div>
      )}

      {/* Parent Ticket */}
      {ticket.parentTicket && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="text-xs font-medium text-indigo-600 uppercase tracking-wide">
              Parent Ticket
            </div>
            <button
              onClick={handleUnlink}
              className="text-indigo-400 hover:text-indigo-600"
              title="Unlink from parent"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <Link
            href={`/tickets/${ticket.parentTicket.id}`}
            className="block hover:bg-indigo-100 rounded-md p-2 -m-2 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm font-semibold text-indigo-900">
                    {ticket.parentTicket.ticketNumber}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(ticket.parentTicket.status)}`}>
                    {ticket.parentTicket.status}
                  </span>
                </div>
                <p className="text-sm text-gray-700 truncate">
                  {ticket.parentTicket.title}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Created {new Date(ticket.parentTicket.createdAt).toLocaleDateString()}
                </p>
              </div>
              <ExternalLink className="w-4 h-4 text-indigo-400 flex-shrink-0" />
            </div>
          </Link>
        </div>
      )}

      {/* Child Tickets */}
      {ticket.childTickets && ticket.childTickets.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            Related Tickets ({ticket.childTickets.length})
          </div>
          <div className="space-y-2">
            {ticket.childTickets.map((child) => (
              <Link
                key={child.id}
                href={`/tickets/${child.id}`}
                className="block bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {child.ticketNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(child.status)}`}>
                        {child.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate ml-5">
                      {child.title}
                    </p>
                    <div className="text-xs text-gray-500 mt-1 ml-5">
                      {child.requester && `${child.requester.firstName} ${child.requester.lastName}`} •
                      {' '}{new Date(child.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
