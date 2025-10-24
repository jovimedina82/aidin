'use client'

import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../components/AuthProvider'
import ProtectedRoute from '../../components/ProtectedRoute'
import Navbar from '../../components/Navbar'
import MarkdownMessage from '../../components/MarkdownMessage'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  MessageCircle,
  Plus,
  Send,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  Menu,
  Copy
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

export default function AidinChatPage() {
  const { makeAuthenticatedRequest, user } = useAuth()
  const [sessions, setSessions] = useState([])
  const [currentSession, setCurrentSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [editingSessionId, setEditingSessionId] = useState(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [copiedMessageId, setCopiedMessageId] = useState(null)
  const messagesEndRef = useRef(null)

  const userRoleNames = user?.roles?.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  ) || []
  const isStaff = userRoleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))

  // Copy message to clipboard
  const copyToClipboard = (text, messageId) => {
    navigator.clipboard.writeText(text)
    setCopiedMessageId(messageId)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopiedMessageId(null), 2000)
  }

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Fetch all sessions on mount
  useEffect(() => {
    console.log('Component mounted. User:', user?.email, 'Is Staff:', isStaff) // Debug log
    if (isStaff) {
      fetchSessions()
    }
  }, [isStaff])

  const fetchSessions = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/aidin-chat/sessions')
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
      }
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }

  const createNewSession = async () => {
    console.log('createNewSession called') // Debug log
    try {
      const response = await makeAuthenticatedRequest('/api/aidin-chat/sessions', {
        method: 'POST',
        body: JSON.stringify({ title: 'New Chat' })
      })

      console.log('Session creation response:', response.status) // Debug log

      if (response.ok) {
        const data = await response.json()
        console.log('Session created:', data.session) // Debug log
        setSessions([data.session, ...sessions])
        setCurrentSession(data.session)
        setMessages([])
        toast.success('New chat created')
      } else {
        const errorData = await response.json()
        console.error('Failed to create session:', errorData) // Debug log
        toast.error(errorData.error || 'Failed to create new chat')
      }
    } catch (error) {
      console.error('Error creating session:', error) // Debug log
      toast.error('Failed to create new chat')
    }
  }

  const loadSession = async (sessionId) => {
    try {
      setLoading(true)
      const response = await makeAuthenticatedRequest(`/api/aidin-chat/sessions/${sessionId}`)

      if (response.ok) {
        const data = await response.json()
        setCurrentSession(data.session)
        setMessages(data.session.messages || [])
      }
    } catch (error) {
      toast.error('Failed to load chat session')
    } finally {
      setLoading(false)
    }
  }

  const deleteSession = async (sessionId) => {
    if (!confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      return
    }

    try {
      const response = await makeAuthenticatedRequest(`/api/aidin-chat/sessions/${sessionId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setSessions(sessions.filter(s => s.id !== sessionId))
        if (currentSession?.id === sessionId) {
          setCurrentSession(null)
          setMessages([])
        }
        toast.success('Chat deleted')
      }
    } catch (error) {
      toast.error('Failed to delete chat')
    }
  }

  const updateSessionTitle = async (sessionId, newTitle) => {
    try {
      const response = await makeAuthenticatedRequest(`/api/aidin-chat/sessions/${sessionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: newTitle })
      })

      if (response.ok) {
        setSessions(sessions.map(s =>
          s.id === sessionId ? { ...s, title: newTitle } : s
        ))
        if (currentSession?.id === sessionId) {
          setCurrentSession({ ...currentSession, title: newTitle })
        }
        setEditingSessionId(null)
        setEditingTitle('')
      }
    } catch (error) {
      toast.error('Failed to update chat title')
    }
  }

  const sendMessage = async (e) => {
    e.preventDefault()

    if (!inputMessage.trim()) {
      return
    }

    // If no session exists, create one first and then send the message
    let sessionToUse = currentSession
    if (!sessionToUse) {
      try {
        const response = await makeAuthenticatedRequest('/api/aidin-chat/sessions', {
          method: 'POST',
          body: JSON.stringify({ title: 'New Chat' })
        })

        if (response.ok) {
          const data = await response.json()
          sessionToUse = data.session
          setSessions([data.session, ...sessions])
          setCurrentSession(data.session)
          setMessages([])
        } else {
          toast.error('Failed to create new chat')
          return
        }
      } catch (error) {
        toast.error('Failed to create new chat')
        return
      }
    }

    setSendingMessage(true)
    const userMessageContent = inputMessage
    setInputMessage('')

    // Optimistically add user message to UI
    const tempUserMessage = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: userMessageContent,
      createdAt: new Date().toISOString()
    }
    setMessages([...messages, tempUserMessage])

    try {
      const response = await makeAuthenticatedRequest(
        `/api/aidin-chat/sessions/${sessionToUse.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content: userMessageContent })
        }
      )

      if (response.ok) {
        const data = await response.json()
        // Replace temp message with real ones
        setMessages(prevMessages => [
          ...prevMessages.filter(m => m.id !== tempUserMessage.id),
          data.userMessage,
          data.assistantMessage
        ])

        // Refresh sessions list to update the title if it changed
        fetchSessions()
      } else {
        // Remove temp message on error
        setMessages(messages.filter(m => m.id !== tempUserMessage.id))
        const errorData = await response.json().catch(() => ({}))
        toast.error(errorData.error || 'Failed to send message')
      }
    } catch (error) {
      setMessages(messages.filter(m => m.id !== tempUserMessage.id))
      toast.error('Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  if (!isStaff) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen bg-gray-50">
          <Navbar />
          <main className="pt-20 p-8">
            <div className="max-w-2xl mx-auto text-center py-12">
              <h1 className="text-2xl font-semibold mb-4">Access Denied</h1>
              <p className="text-gray-600">
                This feature is only available to staff members.
              </p>
            </div>
          </main>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-white">
        <Navbar />

        {/* Main Content */}
        <div className="flex overflow-hidden h-[calc(100vh-var(--nav-h,64px))]">
          {/* Sidebar - Chat History */}
          <div
            className={`${
              sidebarOpen ? 'w-64' : 'w-0'
            } bg-[#2d5954] text-white transition-all duration-300 overflow-hidden flex flex-col fixed left-0 h-[calc(100vh-var(--nav-h,64px))]`}
            style={{ top: 'var(--nav-h, 64px)' }}
          >
            {/* Sidebar Header */}
            <div className="p-4 border-b border-[#3d6964]">
              <Button
                onClick={createNewSession}
                className="w-full bg-[#3d6964] hover:bg-[#4d7974] text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-2">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group relative mb-1 rounded-lg transition-colors ${
                    currentSession?.id === session.id
                      ? 'bg-[#3d6964]'
                      : 'hover:bg-[#3d6964]/50'
                  }`}
                >
                  {editingSessionId === session.id ? (
                    <div className="flex items-center p-2 space-x-1">
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="h-8 text-sm bg-white text-gray-900"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateSessionTitle(session.id, editingTitle)
                          } else if (e.key === 'Escape') {
                            setEditingSessionId(null)
                            setEditingTitle('')
                          }
                        }}
                      />
                      <button
                        onClick={() => updateSessionTitle(session.id, editingTitle)}
                        className="p-1 hover:bg-green-500/20 rounded"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingSessionId(null)
                          setEditingTitle('')
                        }}
                        className="p-1 hover:bg-red-500/20 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => loadSession(session.id)}
                      className="w-full text-left p-3 flex items-start justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {session.title}
                        </p>
                        <p className="text-xs text-gray-300 mt-0.5">
                          {formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingSessionId(session.id)
                            setEditingTitle(session.title)
                          }}
                          className="p-1 hover:bg-white/20 rounded"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteSession(session.id)
                          }}
                          className="p-1 hover:bg-red-500/20 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </button>
                  )}
                </div>
              ))}

              {sessions.length === 0 && (
                <div className="text-center py-8 text-gray-300 text-sm">
                  No chats yet.<br />Start a new conversation!
                </div>
              )}
            </div>

            {/* Sidebar Footer */}
            <div className="p-4 border-t border-[#3d6964] text-xs text-gray-300">
              <p>Chats auto-delete after 30 days</p>
            </div>
          </div>

          {/* Main Chat Area */}
          <div
            className={`flex-1 flex flex-col bg-white relative transition-all duration-300 ${
              sidebarOpen ? 'ml-64' : 'ml-0'
            }`}
          >
            {/* Floating Menu Button */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="absolute top-4 left-4 z-10 p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-600"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {!currentSession && messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-[#3d6964]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-[#3d6964]" />
                    </div>
                    <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                      Welcome to AidIN Assistant
                    </h2>
                    <p className="text-gray-600 mb-6">
                      Your AI-powered helpdesk companion. Ask me anything about technical issues,
                      troubleshooting, code, or general IT support.
                    </p>
                    <Button
                      onClick={createNewSession}
                      className="bg-[#3d6964] hover:bg-[#2d5954] text-white"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Start New Chat
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto space-y-6">
                  {messages.map((message, index) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <div className="group relative max-w-[80%]">
                          <div className="rounded-2xl px-4 py-3 bg-[#3d6964] text-white">
                            <div className="text-sm whitespace-pre-wrap">{message.content}</div>
                            <div className="text-xs mt-2 text-white/70">
                              {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                          <button
                            onClick={() => copyToClipboard(message.content, message.id)}
                            className="absolute -bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 hover:bg-gray-700 text-white p-1.5 rounded-lg shadow-lg"
                            title="Copy message"
                          >
                            {copiedMessageId === message.id ? (
                              <Check size={14} className="text-green-400" />
                            ) : (
                              <Copy size={14} />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="group max-w-full w-full">
                          <div className="flex items-center space-x-2 mb-2">
                            <div className="w-8 h-8 bg-[#3d6964] rounded-full flex items-center justify-center">
                              <Sparkles className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-sm font-semibold text-gray-900">AidIN</span>
                          </div>
                          <div className="ml-10 bg-gray-50 rounded-2xl px-4 py-3 relative">
                            <MarkdownMessage content={message.content} />
                            <div className="flex items-center justify-between mt-3">
                              <div className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                              </div>
                              <button
                                onClick={() => copyToClipboard(message.content, message.id)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity bg-white hover:bg-gray-100 text-gray-700 p-1.5 rounded-lg shadow border border-gray-200"
                                title="Copy message"
                              >
                                {copiedMessageId === message.id ? (
                                  <Check size={14} className="text-green-600" />
                                ) : (
                                  <Copy size={14} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {sendingMessage && (
                    <div className="flex justify-start">
                      <div className="max-w-full w-full">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-8 h-8 bg-[#3d6964] rounded-full flex items-center justify-center">
                            <Sparkles className="w-5 h-5 text-white" />
                          </div>
                          <span className="text-sm font-semibold text-gray-900">AidIN</span>
                        </div>
                        <div className="ml-10 bg-gray-50 rounded-2xl px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
                            </div>
                            <span className="text-sm text-gray-600">Thinking...</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4 bg-gray-50">
              <form onSubmit={sendMessage} className="max-w-3xl mx-auto">
                <div className="flex items-center space-x-2">
                  <Input
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Ask AidIN anything..."
                    className="flex-1 border-gray-300 focus:border-[#3d6964] focus:ring-[#3d6964]"
                    disabled={sendingMessage}
                  />
                  <Button
                    type="submit"
                    disabled={sendingMessage || !inputMessage.trim()}
                    className="bg-[#3d6964] hover:bg-[#2d5954] text-white"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
