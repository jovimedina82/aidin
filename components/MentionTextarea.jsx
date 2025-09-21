'use client'
import { Textarea } from '@/components/ui/textarea'

export default function MentionTextarea({
  value,
  onChange,
  placeholder = "Add a comment...",
  className = "",
  renderMentions,
  ticketId,
  ...props
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      {...props}
    />
  )
}