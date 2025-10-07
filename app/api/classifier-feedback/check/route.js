import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/classifier-feedback/check
 * Check if an email matches previous "NOT_TICKET" feedback
 * Used by n8n workflow to prevent creating tickets for similar emails
 */
export async function POST(request) {
  try {
    const { emailFrom, emailSubject, emailBody } = await request.json()

    if (!emailFrom || !emailSubject) {
      return NextResponse.json({
        shouldBlock: false,
        reason: 'Missing email data'
      })
    }

    console.log(`🔍 Checking classifier feedback for: ${emailFrom} - "${emailSubject}"`)

    // Check for exact sender match with "NOT_TICKET" feedback
    const exactMatch = await prisma.classifierFeedback.findFirst({
      where: {
        feedbackType: 'NOT_TICKET',
        emailFrom: emailFrom
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (exactMatch) {
      console.log(`⛔ BLOCKED: Exact sender match found (feedback ID: ${exactMatch.id})`)
      return NextResponse.json({
        shouldBlock: true,
        reason: `Sender previously marked as "not a ticket"`,
        feedbackId: exactMatch.id,
        matchType: 'exact_sender'
      })
    }

    // Check for similar subject lines
    const similarSubjects = await prisma.classifierFeedback.findMany({
      where: {
        feedbackType: 'NOT_TICKET',
        emailSubject: {
          not: null
        }
      },
      take: 100, // Check last 100 "not a ticket" entries
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Calculate similarity for each feedback entry
    for (const feedback of similarSubjects) {
      const similarity = calculateJaccardSimilarity(
        emailSubject.toLowerCase(),
        feedback.emailSubject.toLowerCase()
      )

      // Also check body similarity if available
      let bodySimilarity = 0
      if (emailBody && feedback.emailBody) {
        bodySimilarity = calculateJaccardSimilarity(
          emailBody.toLowerCase().substring(0, 500),
          feedback.emailBody.toLowerCase().substring(0, 500)
        )
      }

      // Combined similarity (weighted: 70% subject, 30% body)
      const combinedSimilarity = (similarity * 0.7) + (bodySimilarity * 0.3)

      // Block if similarity is high enough
      if (combinedSimilarity > 0.6) {
        console.log(`⛔ BLOCKED: Similar email found (${Math.round(combinedSimilarity * 100)}% match)`)
        console.log(`   Previous subject: "${feedback.emailSubject}"`)
        console.log(`   Current subject: "${emailSubject}"`)

        return NextResponse.json({
          shouldBlock: true,
          reason: `Similar to previous "not a ticket" (${Math.round(combinedSimilarity * 100)}% match)`,
          feedbackId: feedback.id,
          matchType: 'similar_subject',
          similarity: Math.round(combinedSimilarity * 100),
          previousSubject: feedback.emailSubject
        })
      }
    }

    console.log(`✅ ALLOWED: No matching feedback found`)

    return NextResponse.json({
      shouldBlock: false,
      reason: 'No similar "not a ticket" feedback found'
    })

  } catch (error) {
    console.error('Error checking classifier feedback:', error)
    // Don't block on error - fail open
    return NextResponse.json({
      shouldBlock: false,
      reason: 'Feedback check failed',
      error: error.message
    })
  }
}

/**
 * Calculate Jaccard similarity between two strings
 * Returns value between 0 (no similarity) and 1 (identical)
 */
function calculateJaccardSimilarity(str1, str2) {
  // Split into words and create sets
  const words1 = new Set(str1.split(/\s+/).filter(w => w.length > 2))
  const words2 = new Set(str2.split(/\s+/).filter(w => w.length > 2))

  if (words1.size === 0 || words2.size === 0) {
    return 0
  }

  // Calculate intersection and union
  const intersection = new Set([...words1].filter(x => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}
