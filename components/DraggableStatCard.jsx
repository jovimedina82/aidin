'use client'
import { memo } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { GripVertical } from 'lucide-react'

function DraggableStatCard({ id, title, value, description, icon: Icon, color = 'text-muted-foreground', loading }) {
  const router = useRouter()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  // Map stat card IDs to ticket views
  const getTicketView = (cardId) => {
    const viewMap = {
      'total': 'all',
      'open': 'company-open',
      'pending': 'company-pending',
      'solved': 'company-solved',
      'onHold': 'company-on-hold',
      'new': 'company-new'
    }
    return viewMap[cardId] || 'all'
  }

  const handleCardClick = (e) => {
    // Don't navigate if clicking on drag handle
    if (e.target.closest('[data-drag-handle]')) {
      return
    }
    const view = getTicketView(id)
    router.push(`/tickets?view=${view}`)
  }

  return (
    <div ref={setNodeRef} style={style}>
      <Card
        className="relative group cursor-pointer hover:shadow-md transition-shadow"
        onClick={handleCardClick}
      >
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          data-drag-handle
          className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing z-10"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 pl-10">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className={`h-4 w-4 ${color}`} />
        </CardHeader>
        <CardContent className="pl-10">
          <div className={`text-2xl font-bold ${color}`}>
            {loading ? '...' : value}
          </div>
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// Memoize the component to prevent unnecessary re-renders
export default memo(DraggableStatCard, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.id === nextProps.id &&
    prevProps.value === nextProps.value &&
    prevProps.loading === nextProps.loading
  )
})
