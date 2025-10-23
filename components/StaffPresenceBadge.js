'use client'

import { MapPin, Home, Coffee, HeartPulse, Check, CalendarClock, Moon } from 'lucide-react'
import { Badge } from './ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip"
import { format } from 'date-fns'

const STATUS_CONFIG = {
  AVAILABLE: {
    label: 'Available',
    icon: Check,
    color: 'bg-green-100 text-green-800 hover:bg-green-100 border-green-300',
    iconColor: 'text-green-600',
    ringColor: 'ring-green-500/20'
  },
  IN_OFFICE: {
    label: 'In Office',
    icon: MapPin,
    color: 'bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-300',
    iconColor: 'text-blue-600',
    ringColor: 'ring-blue-500/20'
  },
  REMOTE: {
    label: 'Working Remote',
    icon: Home,
    color: 'bg-purple-100 text-purple-800 hover:bg-purple-100 border-purple-300',
    iconColor: 'text-purple-600',
    ringColor: 'ring-purple-500/20'
  },
  VACATION: {
    label: 'On Vacation',
    icon: Coffee,
    color: 'bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-300',
    iconColor: 'text-orange-600',
    ringColor: 'ring-orange-500/20'
  },
  SICK: {
    label: 'Out Sick',
    icon: HeartPulse,
    color: 'bg-red-100 text-red-800 hover:bg-red-100 border-red-300',
    iconColor: 'text-red-600',
    ringColor: 'ring-red-500/20'
  },
  AFTER_HOURS: {
    label: 'After Hours',
    icon: Moon,
    color: 'bg-indigo-100 text-indigo-800 hover:bg-indigo-100 border-indigo-300',
    iconColor: 'text-indigo-600',
    ringColor: 'ring-indigo-500/20'
  }
}

const OFFICE_LOCATIONS = {
  NEWPORT: 'Newport',
  LAGUNA_BEACH: 'Laguna Beach',
  DANA_POINT: 'Dana Point'
}

export default function StaffPresenceBadge({ presence, showIcon = true, showLocation = true, size = 'default' }) {
  if (!presence) {
    return null
  }

  // If user is after hours, override to show After Hours status
  const displayStatus = presence.isAfterHours ? 'AFTER_HOURS' : presence.status
  const config = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.AVAILABLE
  const Icon = config.icon

  // Build the display text with context
  const getDisplayText = () => {
    const parts = []

    // Always show "After Hours" if outside office hours
    if (presence.isAfterHours) {
      return 'After Hours'
    }

    if (presence.status === 'IN_OFFICE' && presence.officeLocation && showLocation) {
      return `In Office - ${OFFICE_LOCATIONS[presence.officeLocation]}`
    } else if (presence.status === 'AVAILABLE' && presence.officeLocation && showLocation) {
      return `Available - ${OFFICE_LOCATIONS[presence.officeLocation]}`
    } else if (presence.status === 'AVAILABLE') {
      return 'Available'
    } else if (presence.status === 'REMOTE') {
      return 'Working Remote'
    } else if (presence.status === 'AFTER_HOURS') {
      return 'After Hours'
    } else {
      return config.label
    }
  }

  const getTooltipContent = () => {
    const parts = []

    // Show after hours with original status
    if (presence.isAfterHours) {
      const originalConfig = STATUS_CONFIG[presence.status] || STATUS_CONFIG.AVAILABLE
      parts.push(`🌙 After Hours`)
      if ((presence.status === 'IN_OFFICE' || presence.status === 'AVAILABLE') && presence.officeLocation) {
        parts.push(`Set as: ${originalConfig.label} at ${OFFICE_LOCATIONS[presence.officeLocation]}`)
      } else {
        parts.push(`Set as: ${originalConfig.label}`)
      }
    } else {
      // Main status with location
      if ((presence.status === 'IN_OFFICE' || presence.status === 'AVAILABLE') && presence.officeLocation) {
        parts.push(`📍 ${config.label} at ${OFFICE_LOCATIONS[presence.officeLocation]}`)
      } else {
        parts.push(`${config.label}`)
      }
    }

    // Notes
    if (presence.notes) {
      parts.push(`💬 ${presence.notes}`)
    }

    // Date range
    const startDate = new Date(presence.startDate)
    if (presence.endDate) {
      const endDate = new Date(presence.endDate)
      parts.push(`📅 ${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`)
    } else {
      parts.push(`📅 Since ${format(startDate, 'MMM d, yyyy')}`)
    }

    return parts.join('\n')
  }

  const displayText = getDisplayText()

  // Size variations
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    default: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-1.5'
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={`
              ${config.color}
              ${sizeClasses[size]}
              flex items-center gap-1.5 cursor-help
              font-medium border
              transition-all hover:scale-105
              ring-2 ${config.ringColor}
              shadow-sm
            `}
          >
            {showIcon && <Icon className={`h-4 w-4 ${config.iconColor}`} strokeWidth={2.5} />}
            <span className="font-semibold">{displayText}</span>
            {presence.endDate && (
              <CalendarClock className="h-3 w-3 ml-1 opacity-70" />
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="whitespace-pre-line max-w-xs">
          <div className="space-y-1">
            {getTooltipContent()}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
