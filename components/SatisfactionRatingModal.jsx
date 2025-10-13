'use client'

import { useState } from 'react'
import { Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/components/AuthProvider'
import { toast } from 'sonner'

export default function SatisfactionRatingModal({ ticketId, ticketNumber, isOpen, onClose, onSubmit }) {
  const { makeAuthenticatedRequest } = useAuth()
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error('Please select a rating')
      return
    }

    try {
      setSubmitting(true)

      const response = await makeAuthenticatedRequest(`/api/tickets/${ticketId}/satisfaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          feedback: feedback.trim() || null
        })
      })

      if (response.ok) {
        toast.success('Thank you for your feedback!')
        if (onSubmit) {
          onSubmit({ rating, feedback })
        }
        onClose()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to submit rating')
      }
    } catch (error) {
      console.error('Error submitting rating:', error)
      toast.error('Failed to submit rating')
    } finally {
      setSubmitting(false)
    }
  }

  const getRatingLabel = (score) => {
    switch (score) {
      case 1: return 'Very Dissatisfied'
      case 2: return 'Dissatisfied'
      case 3: return 'Neutral'
      case 4: return 'Satisfied'
      case 5: return 'Very Satisfied'
      default: return ''
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Your Experience</DialogTitle>
          <DialogDescription>
            Ticket #{ticketNumber} is being marked as solved. How satisfied are you with the resolution?
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {/* Star Rating */}
          <div className="flex flex-col items-center space-y-4">
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-full p-1 transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-12 h-12 transition-colors ${
                      (hoveredRating || rating) >= star
                        ? 'fill-yellow-400 stroke-yellow-400'
                        : 'fill-none stroke-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>

            {/* Rating Label */}
            {(hoveredRating || rating) > 0 && (
              <p className="text-lg font-medium text-gray-900 animate-in fade-in duration-200">
                {getRatingLabel(hoveredRating || rating)}
              </p>
            )}
          </div>

          {/* Feedback Textarea */}
          <div className="mt-6 space-y-2">
            <label htmlFor="feedback" className="text-sm font-medium text-gray-700">
              Additional Feedback (Optional)
            </label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us more about your experience..."
              rows={4}
              className="resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Skip
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || rating === 0}
          >
            {submitting ? 'Submitting...' : 'Submit Rating'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
