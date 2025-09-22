'use client'
import { useState, useRef, useEffect } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from './AuthProvider'
import UserProfileModal from './UserProfileModal'

export default function MentionTextarea({
  value,
  onChange,
  placeholder = "Add a comment...",
  className = "",
  renderMentions,
  ticketId,
  readOnly,
  ...props
}) {
  const { makeAuthenticatedRequest } = useAuth()
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState('')
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 })
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState(null)
  const textareaRef = useRef(null)
  const mentionDropdownRef = useRef(null)

  // Fetch users for mentions
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await makeAuthenticatedRequest('/api/users')
        if (response.ok) {
          const data = await response.json()
          setUsers(data)
        }
      } catch (error) {
        console.error('Failed to fetch users for mentions:', error)
      }
    }
    fetchUsers()
  }, [makeAuthenticatedRequest])

  // Filter users based on mention search
  useEffect(() => {
    if (mentionSearch) {
      const filtered = users.filter(user =>
        `${user.firstName} ${user.lastName}`.toLowerCase().includes(mentionSearch.toLowerCase()) ||
        user.email.toLowerCase().includes(mentionSearch.toLowerCase())
      )
      setFilteredUsers(filtered)
      setSelectedIndex(0)
    } else {
      setFilteredUsers(users)
      setSelectedIndex(0)
    }
  }, [mentionSearch, users])

  const handleTextChange = (e) => {
    const text = e.target.value
    const textarea = e.target
    const cursorPosition = textarea.selectionStart

    // Check if @ was typed
    const beforeCursor = text.substring(0, cursorPosition)
    const mentionMatch = beforeCursor.match(/@(\w*)$/)

    if (mentionMatch) {
      // Show mention dropdown
      const search = mentionMatch[1]
      setMentionSearch(search)
      setShowMentions(true)

      // Calculate position for dropdown
      const textBeforeMention = beforeCursor.substring(0, mentionMatch.index)
      const lines = textBeforeMention.split('\n')
      const currentLine = lines.length - 1
      const charPosition = lines[lines.length - 1].length

      // Rough calculation for position (this could be improved with a proper text measurement)
      const lineHeight = 20 // approximate line height
      const charWidth = 8 // approximate character width
      const top = (currentLine + 1) * lineHeight + 40 // 40px offset for textarea padding
      const left = charPosition * charWidth + 10 // 10px offset

      setMentionPosition({ top, left })
    } else {
      // Hide mention dropdown
      setShowMentions(false)
      setMentionSearch('')
    }

    onChange(text)
  }

  const handleKeyDown = (e) => {
    if (showMentions && filteredUsers.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev =>
            prev < filteredUsers.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredUsers.length - 1
          )
          break
        case 'Enter':
        case 'Tab':
          e.preventDefault()
          selectMention(filteredUsers[selectedIndex])
          break
        case 'Escape':
          e.preventDefault()
          setShowMentions(false)
          break
      }
    }
  }

  const selectMention = (user) => {
    if (!user) return

    const textarea = textareaRef.current
    const cursorPosition = textarea.selectionStart
    const beforeCursor = value.substring(0, cursorPosition)
    const afterCursor = value.substring(cursorPosition)

    // Find the @ symbol position
    const mentionMatch = beforeCursor.match(/@(\w*)$/)
    if (mentionMatch) {
      const mentionStart = mentionMatch.index
      const beforeMention = beforeCursor.substring(0, mentionStart)
      const mentionText = `@${user.firstName} ${user.lastName}`
      const newValue = beforeMention + mentionText + ' ' + afterCursor

      onChange(newValue)
      setShowMentions(false)
      setMentionSearch('')

      // Set cursor position after the mention
      setTimeout(() => {
        const newCursorPos = beforeMention.length + mentionText.length + 1
        textarea.setSelectionRange(newCursorPos, newCursorPos)
        textarea.focus()
      }, 0)
    }
  }

  const handleMentionClick = (user) => {
    selectMention(user)
  }

  const handleMentionLinkClick = (mentionText) => {
    // Extract the name from the mention and find the user
    const name = mentionText.replace('@', '').trim()
    const user = users.find(u =>
      `${u.firstName} ${u.lastName}` === name
    )

    if (user) {
      setSelectedUserId(user.id)
      setShowProfileModal(true)
    }
  }

  const renderTextWithMentions = (text) => {
    if (!renderMentions || !text) {
      return text
    }

    // Regular expression to match @mentions
    const mentionRegex = /@([A-Za-z]+\s+[A-Za-z]+)/g
    const parts = []
    let lastIndex = 0
    let match

    while ((match = mentionRegex.exec(text)) !== null) {
      // Add text before the mention
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }

      // Add the clickable mention
      const mentionText = match[0]
      const name = match[1]

      parts.push(
        <span
          key={`mention-${match.index}`}
          className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium"
          onClick={() => handleMentionLinkClick(mentionText)}
        >
          {mentionText}
        </span>
      )

      lastIndex = match.index + match[0].length
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }

  return (
    <div className="relative">
      {readOnly && renderMentions ? (
        // Render formatted text with clickable mentions for read-only mode
        <div className={`whitespace-pre-wrap ${className}`} {...props}>
          {renderTextWithMentions(value)}
        </div>
      ) : (
        // Render textarea for editing
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={className}
          readOnly={readOnly}
          {...props}
        />
      )}

      {showMentions && filteredUsers.length > 0 && !readOnly && (
        <div
          ref={mentionDropdownRef}
          className="absolute z-50 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto min-w-[200px]"
          style={{
            top: mentionPosition.top,
            left: mentionPosition.left,
          }}
        >
          {filteredUsers.slice(0, 10).map((user, index) => (
            <div
              key={user.id}
              className={`px-3 py-2 cursor-pointer flex items-center gap-2 ${
                index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
              }`}
              onClick={() => handleMentionClick(user)}
            >
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {user.firstName} {user.lastName}
                </div>
                <div className="text-xs text-gray-500">
                  {user.email}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        userId={selectedUserId}
      />
    </div>
  )
}