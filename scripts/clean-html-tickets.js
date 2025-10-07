#!/usr/bin/env node

/**
 * Clean HTML from existing tickets
 * This script finds all tickets with HTML content and strips it to clean plain text
 */

import { prisma } from '../lib/prisma.js'

// Utility function to strip HTML and convert to clean, well-formatted plain text
function stripHtml(html) {
  if (!html) return ''

  let text = String(html)

  // Remove script and style tags and their content
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove head section entirely (contains meta tags, styles, etc)
  text = text.replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '')

  // Extract link text before removing anchors (preserve readable links)
  // For Microsoft safe links, try to extract the actual URL
  text = text.replace(/<a[^>]+href="https:\/\/nam04\.safelinks\.protection\.outlook\.com\/\?url=([^&]+)[^"]*"[^>]*>([^<]*)<\/a>/gi, (match, encodedUrl, linkText) => {
    try {
      const decoded = decodeURIComponent(encodedUrl)
      return linkText || decoded
    } catch {
      return linkText || ''
    }
  })

  // For regular links, keep just the link text
  text = text.replace(/<a[^>]+>([^<]*)<\/a>/gi, '$1')

  // Remove image tags completely
  text = text.replace(/<img[^>]*>/gi, '')

  // Convert block-level elements to proper paragraph spacing
  // Paragraphs get double newlines for visual separation
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<p[^>]*>/gi, '')

  // Divs get single newlines
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<div[^>]*>/gi, '')

  // Headers get double newlines for emphasis
  text = text.replace(/<\/h[1-6]>/gi, '\n\n')
  text = text.replace(/<h[1-6][^>]*>/gi, '')

  // Line breaks
  text = text.replace(/<br[^>]*>/gi, '\n')

  // Lists - preserve bullet structure
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<li[^>]*>/gi, '• ')
  text = text.replace(/<\/?[uo]l[^>]*>/gi, '\n')

  // Tables - try to preserve some structure
  text = text.replace(/<\/tr>/gi, '\n')
  text = text.replace(/<tr[^>]*>/gi, '')
  text = text.replace(/<\/td>/gi, ' ')
  text = text.replace(/<td[^>]*>/gi, '')
  text = text.replace(/<\/?table[^>]*>/gi, '\n')
  text = text.replace(/<\/?tbody[^>]*>/gi, '')

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  const entities = {
    '&nbsp;': ' ',
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&mdash;': '—',
    '&ndash;': '–',
    '&rsquo;': "'",
    '&lsquo;': "'",
    '&rdquo;': '"',
    '&ldquo;': '"',
    '&hellip;': '...',
    '&copy;': '©',
    '&reg;': '®',
    '&trade;': '™',
    '&bull;': '•'
  }

  Object.entries(entities).forEach(([entity, char]) => {
    text = text.replace(new RegExp(entity, 'gi'), char)
  })

  // Decode numeric entities (e.g., &#160;)
  text = text.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
  text = text.replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))

  // Clean up whitespace while preserving paragraph structure
  // First, normalize line endings
  text = text.replace(/\r\n/g, '\n')
  text = text.replace(/\r/g, '\n')

  // Remove lines that are just whitespace
  text = text.replace(/^\s+$/gm, '')

  // Collapse more than 2 consecutive newlines to 2 (paragraph spacing)
  text = text.replace(/\n{3,}/g, '\n\n')

  // Trim whitespace from each line
  text = text.split('\n').map(line => line.trim()).join('\n')

  // Remove leading/trailing whitespace from the whole text
  text = text.trim()

  return text
}

// Check if text contains HTML
function containsHtml(text) {
  if (!text) return false
  return /<[^>]+>/g.test(text)
}

async function cleanTickets() {
  console.log('🔍 Finding tickets with HTML content...\n')

  // Get all tickets
  const tickets = await prisma.ticket.findMany({
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      description: true
    }
  })

  console.log(`Found ${tickets.length} total tickets\n`)

  let cleanedCount = 0
  const updates = []

  for (const ticket of tickets) {
    const titleHasHtml = containsHtml(ticket.title)
    const descriptionHasHtml = containsHtml(ticket.description)

    if (titleHasHtml || descriptionHasHtml) {
      const cleanTitle = titleHasHtml ? stripHtml(ticket.title) : ticket.title
      const cleanDescription = descriptionHasHtml ? stripHtml(ticket.description) : ticket.description

      console.log(`📝 Cleaning ticket ${ticket.ticketNumber}:`)
      if (titleHasHtml) {
        console.log(`   Title: "${ticket.title.substring(0, 80)}..." -> "${cleanTitle.substring(0, 80)}..."`)
      }
      if (descriptionHasHtml) {
        console.log(`   Description has HTML (${ticket.description.length} chars -> ${cleanDescription.length} chars)`)
      }

      updates.push({
        id: ticket.id,
        title: cleanTitle,
        description: cleanDescription
      })

      cleanedCount++
    }
  }

  console.log(`\n✨ Found ${cleanedCount} tickets with HTML content\n`)

  if (updates.length === 0) {
    console.log('✅ No tickets need cleaning!')
    return
  }

  console.log('💾 Updating tickets in database...\n')

  // Update tickets in batches
  for (const update of updates) {
    await prisma.ticket.update({
      where: { id: update.id },
      data: {
        title: update.title,
        description: update.description
      }
    })
  }

  console.log(`✅ Successfully cleaned ${cleanedCount} tickets!`)
}

async function cleanComments() {
  console.log('\n🔍 Finding comments with HTML content...\n')

  const comments = await prisma.ticketComment.findMany({
    select: {
      id: true,
      ticketId: true,
      content: true
    }
  })

  console.log(`Found ${comments.length} total comments\n`)

  let cleanedCount = 0
  const updates = []

  for (const comment of comments) {
    if (containsHtml(comment.content)) {
      const cleanContent = stripHtml(comment.content)

      console.log(`💬 Cleaning comment ${comment.id}:`)
      console.log(`   Content: "${comment.content.substring(0, 80)}..." -> "${cleanContent.substring(0, 80)}..."`)

      updates.push({
        id: comment.id,
        content: cleanContent
      })

      cleanedCount++
    }
  }

  console.log(`\n✨ Found ${cleanedCount} comments with HTML content\n`)

  if (updates.length === 0) {
    console.log('✅ No comments need cleaning!')
    return
  }

  console.log('💾 Updating comments in database...\n')

  for (const update of updates) {
    await prisma.ticketComment.update({
      where: { id: update.id },
      data: {
        content: update.content
      }
    })
  }

  console.log(`✅ Successfully cleaned ${cleanedCount} comments!`)
}

async function main() {
  console.log('🧹 Starting HTML cleanup for tickets and comments\n')
  console.log('=' .repeat(60) + '\n')

  try {
    await cleanTickets()
    await cleanComments()

    console.log('\n' + '=' .repeat(60))
    console.log('✅ HTML cleanup completed successfully!')
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
