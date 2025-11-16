'use client'

import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import {
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Pause,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Status badge component
export const StatusBadge = ({ status }) => {
  const statusConfig = {
    NEW: {
      icon: <AlertTriangle className="w-3 h-3" />,
      className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      label: 'New',
    },
    OPEN: {
      icon: <AlertCircle className="w-3 h-3" />,
      className: 'bg-blue-100 text-blue-800 border-blue-200',
      label: 'Open',
    },
    PENDING: {
      icon: <Clock className="w-3 h-3" />,
      className: 'bg-orange-100 text-orange-800 border-orange-200',
      label: 'Pending',
    },
    ON_HOLD: {
      icon: <Pause className="w-3 h-3" />,
      className: 'bg-gray-100 text-gray-800 border-gray-200',
      label: 'On Hold',
    },
    SOLVED: {
      icon: <CheckCircle className="w-3 h-3" />,
      className: 'bg-green-100 text-green-800 border-green-200',
      label: 'Solved',
    },
  }

  const config = statusConfig[status] || statusConfig.NEW

  return (
    <Badge
      variant="outline"
      className={cn('flex items-center gap-1 font-medium text-xs', config.className)}
    >
      {config.icon}
      {config.label}
    </Badge>
  )
}

// Priority badge component
export const PriorityBadge = ({ priority }) => {
  if (!priority) return null

  const priorityConfig = {
    LOW: 'bg-gray-100 text-gray-700',
    MEDIUM: 'bg-blue-100 text-blue-700',
    HIGH: 'bg-orange-100 text-orange-700',
    URGENT: 'bg-red-100 text-red-700',
  }

  return (
    <Badge variant="outline" className={cn('text-xs font-medium', priorityConfig[priority])}>
      {priority}
    </Badge>
  )
}

// Create columns with user context
export const createTicketColumns = (currentUserId, showAssignee = true) => {
  const baseColumns = [
    {
      accessorKey: 'status',
      header: 'Status',
      size: 120,
      cell: ({ row }) => <StatusBadge status={row.getValue('status')} />,
      enableSorting: true,
    },
    {
      accessorKey: 'ticketNumber',
      header: 'Ticket #',
      size: 100,
      cell: ({ row }) => (
        <span className="font-mono text-sm text-gray-600">
          #{row.getValue('ticketNumber')}
        </span>
      ),
      enableSorting: true,
    },
    {
      accessorKey: 'title',
      header: 'Subject',
      size: 400,
      cell: ({ row }) => {
        const ticket = row.original
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900 truncate max-w-[350px]">
                {ticket.title}
              </span>
              {ticket.requesterId === currentUserId && (
                <Badge className="bg-blue-600 text-white text-xs shrink-0">
                  Self Created
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">
                {ticket.category}
              </Badge>
              <PriorityBadge priority={ticket.priority} />
            </div>
          </div>
        )
      },
      enableSorting: true,
    },
    {
      accessorKey: 'requester',
      header: 'Requester',
      size: 180,
      cell: ({ row }) => {
        const requester = row.original.requester
        if (!requester) return <span className="text-gray-400">Unknown</span>
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <span className="text-sm text-gray-900">
              {requester.firstName} {requester.lastName}
            </span>
          </div>
        )
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.requester
        const b = rowB.original.requester
        if (!a && !b) return 0
        if (!a) return 1
        if (!b) return -1
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
        return nameA.localeCompare(nameB)
      },
    },
  ]

  if (showAssignee) {
    baseColumns.push({
      accessorKey: 'assignee',
      header: 'Assignee',
      size: 180,
      cell: ({ row }) => {
        const assignee = row.original.assignee
        if (!assignee) {
          return <span className="text-gray-400 italic">Unassigned</span>
        }
        return (
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
              <User className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-sm text-gray-900">
              {assignee.firstName} {assignee.lastName}
            </span>
          </div>
        )
      },
      enableSorting: true,
      sortingFn: (rowA, rowB) => {
        const a = rowA.original.assignee
        const b = rowB.original.assignee
        if (!a && !b) return 0
        if (!a) return 1
        if (!b) return -1
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
        return nameA.localeCompare(nameB)
      },
    })
  }

  baseColumns.push({
    accessorKey: 'createdAt',
    header: 'Created',
    size: 140,
    cell: ({ row }) => (
      <span className="text-sm text-gray-500">
        {formatDistanceToNow(new Date(row.getValue('createdAt')), {
          addSuffix: true,
        })}
      </span>
    ),
    enableSorting: true,
  })

  return baseColumns
}
