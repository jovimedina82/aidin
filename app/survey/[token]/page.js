'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { CheckCircle, Loader2 } from 'lucide-react'

export default function SatisfactionSurveyPage({ params }) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [ticketInfo, setTicketInfo] = useState(null)
  const [selectedRating, setSelectedRating] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  // Emoji ratings from sad to happy
  const ratings = [
    { value: 1, emoji: '😞', label: 'Very Dissatisfied', color: '#ef4444' },
    { value: 2, emoji: '😕', label: 'Dissatisfied', color: '#f97316' },
    { value: 3, emoji: '😐', label: 'Neutral', color: '#eab308' },
    { value: 4, emoji: '😊', label: 'Satisfied', color: '#84cc16' },
    { value: 5, emoji: '😄', label: 'Very Satisfied', color: '#22c55e' }
  ]

  useEffect(() => {
    verifyToken()
  }, [])

  const verifyToken = async () => {
    try {
      console.log('Verifying token:', params.token)
      const response = await fetch(`/api/public/verify-survey-token?token=${params.token}`)
      console.log('Response status:', response.status)

      if (response.ok) {
        const data = await response.json()
        console.log('Ticket data:', data)
        setTicketInfo(data)
      } else {
        const error = await response.json()
        console.error('API error:', error)
        setError(error.error || 'Invalid or expired link')
      }
    } catch (error) {
      console.error('Failed to verify token:', error)
      setError(`Failed to load survey: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedRating) {
      setError('Please select a rating')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/public/submit-satisfaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          token: params.token,
          rating: selectedRating,
          feedback: feedback.trim()
        })
      })

      if (response.ok) {
        setSubmitted(true)
      } else {
        const error = await response.json()
        setError(error.error || 'Failed to submit survey')
      }
    } catch (error) {
      console.error('Failed to submit survey:', error)
      setError('Failed to submit survey. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3d6964] to-[#2d5954] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#3d6964]" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3d6964] to-[#2d5954] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-700">{error}</p>
            <p className="text-sm text-gray-500 mt-4">
              This link may have expired or is no longer valid. Please contact support if you need assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#3d6964] to-[#2d5954] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl">Thank You!</CardTitle>
            <CardDescription>Your feedback has been submitted successfully</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-700 mb-4">
              Ticket <strong>#{ticketInfo?.ticketNumber}</strong> has been marked as solved.
            </p>
            <p className="text-sm text-gray-600">
              We appreciate your feedback and will use it to improve our service.
            </p>
            <div className="mt-6 text-xs text-gray-500">
              You can now close this window.
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#3d6964] to-[#2d5954] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">How satisfied are you with our support?</CardTitle>
          <CardDescription>
            Ticket <strong>#{ticketInfo?.ticketNumber}</strong> - {ticketInfo?.title}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Emoji Rating Selection */}
          <div className="mb-8">
            <p className="text-center text-sm text-gray-600 mb-6">
              Please rate your experience:
            </p>
            <div className="flex justify-center gap-4">
              {ratings.map((rating) => (
                <button
                  key={rating.value}
                  onClick={() => setSelectedRating(rating.value)}
                  className={`flex flex-col items-center p-4 rounded-lg transition-all transform hover:scale-110 ${
                    selectedRating === rating.value
                      ? 'bg-gray-100 ring-4 ring-offset-2 scale-110'
                      : 'hover:bg-gray-50'
                  }`}
                  style={{
                    ringColor: selectedRating === rating.value ? rating.color : undefined
                  }}
                >
                  <span className="text-5xl mb-2">{rating.emoji}</span>
                  <span className="text-xs text-gray-600 font-medium text-center max-w-[80px]">
                    {rating.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Optional Feedback */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional feedback (optional)
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us more about your experience..."
              rows={4}
              className="w-full"
            />
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedRating || submitting}
            className="w-full bg-[#3d6964] hover:bg-[#2d5954] text-white h-12 text-base"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Submitting...
              </>
            ) : (
              'Submit & Mark as Solved'
            )}
          </Button>

          <p className="text-xs text-center text-gray-500 mt-4">
            By submitting this survey, you confirm that your issue has been resolved and the ticket will be marked as solved.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
