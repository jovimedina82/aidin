'use client'
import { memo, useMemo, useCallback } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Clock, MessageCircle, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

const priorityColors = {
  LOW: 'bg-green-100 text-green-800 border-green-200',
  NORMAL: 'bg-blue-100 text-blue-800 border-blue-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  URGENT: 'bg-red-100 text-red-800 border-red-200'
}

const statusColors = {
  NEW: 'bg-red-100 text-red-800 border-red-200',
  OPEN: 'bg-blue-100 text-blue-800 border-blue-200',
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ON_HOLD: 'bg-orange-100 text-orange-800 border-orange-200',
  SOLVED: 'bg-green-100 text-green-800 border-green-200'
}

const statusBackgroundColors = {
  NEW: 'bg-red-50/50',
  OPEN: 'bg-blue-50/50',
  PENDING: 'bg-yellow-50/50',
  ON_HOLD: 'bg-orange-50/50',
  SOLVED: 'bg-green-50/50'
}

function TicketCard({ ticket, onClick, currentUserId }) {
  // Memoize computed values to prevent recalculation on every render
  const requesterInitials = useMemo(() => {
    return ticket.requester?.firstName && ticket.requester?.lastName
      ? `${ticket.requester.firstName[0]}${ticket.requester.lastName[0]}`
      : '??'
  }, [ticket.requester?.firstName, ticket.requester?.lastName])

  const assigneeInitials = useMemo(() => {
    return ticket.assignee?.firstName && ticket.assignee?.lastName
      ? `${ticket.assignee.firstName[0]}${ticket.assignee.lastName[0]}`
      : null
  }, [ticket.assignee?.firstName, ticket.assignee?.lastName])

  const requesterFullName = useMemo(() => {
    return ticket.requester?.firstName && ticket.requester?.lastName
      ? `${ticket.requester.firstName} ${ticket.requester.lastName}`
      : 'Unknown User'
  }, [ticket.requester?.firstName, ticket.requester?.lastName])

  const formattedTime = useMemo(() => {
    return formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })
  }, [ticket.createdAt])

  // Memoize the click handler to prevent unnecessary re-renders
  const handleClick = useCallback(() => {
    onClick(ticket)
  }, [onClick, ticket])

  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow duration-200 ${statusBackgroundColors[ticket.status]}`}
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                #{ticket.ticketNumber}
              </span>
              <Badge className={priorityColors[ticket.priority]}>
                {ticket.priority}
              </Badge>
              <Badge className={statusColors[ticket.status]}>
                {ticket.status}
              </Badge>
            </div>
            <h3 className="font-semibold text-foreground leading-5 mb-1">
              {ticket.title}
            </h3>
            {ticket.category && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                {ticket.category}
              </span>
            )}
          </div>
          {ticket.requesterId === currentUserId && (
            <div className="text-xs font-semibold text-white bg-blue-600 px-2 py-1 rounded ml-2 flex-shrink-0">
              Self Created
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
          {ticket.description}
        </p>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <User size={12} />
              <Avatar className="h-5 w-5">
                <AvatarFallback className="text-xs">{requesterInitials}</AvatarFallback>
              </Avatar>
              <span>{requesterFullName}</span>
            </div>

            {ticket.assignee && (
              <div className="flex items-center space-x-1">
                <span>→</span>
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs">{assigneeInitials}</AvatarFallback>
                </Avatar>
                <span>{ticket.assignee?.firstName || 'Assignee'}</span>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {ticket._count?.comments > 0 && (
              <div className="flex items-center space-x-1">
                <MessageCircle size={12} />
                <span>{ticket._count.comments}</span>
              </div>
            )}

            <div className="flex items-center space-x-1">
              <Clock size={12} />
              <span>{formattedTime}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Export memoized component with custom comparison function
export default memo(TicketCard, (prevProps, nextProps) => {
  // Only re-render if ticket data has actually changed
  return (
    prevProps.ticket.id === nextProps.ticket.id &&
    prevProps.ticket.status === nextProps.ticket.status &&
    prevProps.ticket.priority === nextProps.ticket.priority &&
    prevProps.ticket.title === nextProps.ticket.title &&
    prevProps.ticket.updatedAt === nextProps.ticket.updatedAt &&
    prevProps.ticket._count?.comments === nextProps.ticket._count?.comments
  )
})