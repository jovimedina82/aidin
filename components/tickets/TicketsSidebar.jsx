'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Pause,
  UserX,
  Archive,
  ChevronDown,
  ChevronRight,
  Plus,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export function TicketsSidebar({
  personalViews,
  companyViews,
  currentView,
  onViewChange,
  onNewTicket,
  isStaff = false,
}) {
  const [personalExpanded, setPersonalExpanded] = useState(true)
  const [companyExpanded, setCompanyExpanded] = useState(true)

  const renderViewItem = (view) => {
    const Icon = view.icon
    const isActive = currentView === view.id
    const hasTickets = view.count > 0

    return (
      <button
        key={view.id}
        onClick={() => onViewChange(view.id)}
        className={cn(
          'w-full flex items-center justify-between px-3 py-2 text-sm rounded-md transition-colors',
          isActive
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-700 hover:bg-gray-100'
        )}
      >
        <div className="flex items-center gap-2">
          <Icon
            className={cn(
              'w-4 h-4',
              isActive ? 'text-blue-600' : 'text-gray-500'
            )}
          />
          <span>{view.label}</span>
        </div>
        <Badge
          variant="secondary"
          className={cn(
            'text-xs min-w-[24px] justify-center',
            hasTickets ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500',
            isActive && 'bg-blue-200'
          )}
        >
          {view.count}
        </Badge>
      </button>
    )
  }

  return (
    <div className="w-64 bg-white border-r flex flex-col h-full">
      {/* New Ticket Button */}
      <div className="p-4 border-b">
        <Button
          onClick={onNewTicket}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Ticket
        </Button>
      </div>

      {/* Views */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          {/* Personal Views */}
          <div>
            <button
              onClick={() => setPersonalExpanded(!personalExpanded)}
              className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
            >
              <span>Personal Views</span>
              {personalExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
            {personalExpanded && (
              <div className="mt-1 space-y-0.5">
                {personalViews.map(renderViewItem)}
              </div>
            )}
          </div>

          {/* Company Views - Staff Only */}
          {isStaff && (
            <div>
              <button
                onClick={() => setCompanyExpanded(!companyExpanded)}
                className="flex items-center justify-between w-full px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
              >
                <span>Company Views</span>
                {companyExpanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
              {companyExpanded && (
                <div className="mt-1 space-y-0.5">
                  {companyViews.map(renderViewItem)}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

// View configurations with icons
export const PERSONAL_VIEWS = [
  { id: 'personal-new', label: 'New', icon: AlertTriangle },
  { id: 'personal-open', label: 'Open', icon: AlertCircle },
  { id: 'personal-pending', label: 'Pending', icon: Clock },
  { id: 'personal-on-hold', label: 'On-hold', icon: Pause },
  { id: 'personal-solved', label: 'Recently Solved', icon: CheckCircle },
  { id: 'personal-solved-history', label: 'Historic Solved', icon: Archive },
]

export const COMPANY_VIEWS = [
  { id: 'unassigned', label: 'Unassigned', icon: UserX },
  { id: 'company-new', label: 'New', icon: AlertTriangle },
  { id: 'company-open', label: 'Open', icon: AlertCircle },
  { id: 'company-pending', label: 'Pending', icon: Clock },
  { id: 'company-on-hold', label: 'On-Hold', icon: Pause },
  { id: 'company-solved', label: 'Recently Solved', icon: CheckCircle },
  { id: 'all-unsolved', label: 'All Unsolved', icon: AlertTriangle },
  { id: 'solved-history', label: 'Historic Solved', icon: Archive },
]
