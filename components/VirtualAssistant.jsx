'use client'
import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Bot, User, Send, Minimize2, Maximize2, X, Loader2 } from 'lucide-react'
import { useAuth } from './AuthProvider'

const VirtualAssistant = ({ ticket = null, isMinimized = false, onToggleMinimize, onClose }) => {
  const { makeAuthenticatedRequest, user } = useAuth()
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'assistant',
      content: ticket
        ? `Hi! I'm AidIN Assistant. I can help you with ticket #${ticket.ticketNumber}. What would you like to know?`
        : "Hi! I'm AidIN Assistant. I can help you troubleshoot issues, find solutions, and guide you through ticket resolution. How can I assist you today?",
      timestamp: new Date()
    }
  ])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (!isMinimized && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isMinimized])

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await makeAuthenticatedRequest('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          ticket: ticket,
          conversationHistory: messages.slice(-5) // Last 5 messages for context
        })
      })

      if (response.ok) {
        const data = await response.json()
        const assistantMessage = {
          id: Date.now() + 1,
          type: 'assistant',
          content: data.response,
          suggestions: data.suggestions,
          timestamp: new Date(),
          foundSimilarTickets: data.foundSimilarTickets || 0,
          foundKnowledgeBase: data.foundKnowledgeBase || 0
        }
        setMessages(prev => [...prev, assistantMessage])
      } else {
        throw new Error('Failed to get response')
      }
    } catch (error) {
      // console.error('Failed to send message:', error)
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: "I'm sorry, I'm having trouble responding right now. Please try again in a moment.",
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const applySuggestion = (suggestion) => {
    setInputMessage(suggestion)
    inputRef.current?.focus()
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={onToggleMinimize}
          className="h-12 w-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
        >
          <Bot className="h-6 w-6 text-white" />
        </Button>
      </div>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 w-96 h-[500px] z-50 shadow-xl border-2 border-blue-200">
      <CardHeader className="bg-blue-600 text-white p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="h-5 w-5" />
            <CardTitle className="text-sm font-medium">
              AidIN Assistant
              {ticket && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  #{ticket.ticketNumber}
                </Badge>
              )}
            </CardTitle>
          </div>
          <div className="flex space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleMinimize}
              className="h-6 w-6 p-0 text-white hover:bg-blue-700"
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 text-white hover:bg-blue-700"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex flex-col h-[440px]">
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <div className="flex items-start space-x-2">
                    {message.type === 'assistant' && (
                      <Bot className="h-4 w-4 mt-0.5 text-blue-600" />
                    )}
                    <div className="flex-1">
                      <p className="text-sm whitespace-pre-wrap">{message.content}</p>

                      {/* Knowledge Base and Similar Tickets Indicators */}
                      {message.type === 'assistant' && (message.foundSimilarTickets > 0 || message.foundKnowledgeBase > 0) && (
                        <div className="mt-2 p-2 bg-blue-50 rounded text-xs">
                          <div className="flex items-center space-x-3">
                            {message.foundSimilarTickets > 0 && (
                              <span className="text-blue-700">
                                🎫 {message.foundSimilarTickets} similar resolved ticket{message.foundSimilarTickets > 1 ? 's' : ''} found
                              </span>
                            )}
                            {message.foundKnowledgeBase > 0 && (
                              <span className="text-blue-700">
                                📚 {message.foundKnowledgeBase} knowledge base article{message.foundKnowledgeBase > 1 ? 's' : ''} referenced
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {message.suggestions && message.suggestions.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs opacity-75">Quick actions:</p>
                          {message.suggestions.map((suggestion, index) => (
                            <Button
                              key={index}
                              variant="outline"
                              size="sm"
                              className="text-xs h-6 mr-1 mb-1"
                              onClick={() => applySuggestion(suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                    {message.type === 'user' && (
                      <User className="h-4 w-4 mt-0.5 text-white" />
                    )}
                  </div>
                  <p className="text-xs opacity-50 mt-1">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-4 w-4 text-blue-600" />
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    <span className="text-sm text-gray-600">AidIN is thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div ref={messagesEndRef} />
        </ScrollArea>

        <div className="border-t p-3">
          <div className="flex space-x-2">
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask AidIN for help..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default VirtualAssistant