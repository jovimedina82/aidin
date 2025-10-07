#!/usr/bin/env node

/**
 * Manually process attachments for a ticket by finding its email in Microsoft Graph
 */

import { EmailAttachmentHandler } from '../lib/services/EmailAttachmentHandler.js'
import { prisma } from '../lib/prisma.js'
import { ConfidentialClientApplication } from '@azure/msal-node'

const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
  }
}

const msalClient = new ConfidentialClientApplication(msalConfig)

async function getAccessToken() {
  const tokenRequest = {
    scopes: ['https://graph.microsoft.com/.default']
  }
  const response = await msalClient.acquireTokenByClientCredential(tokenRequest)
  return response.accessToken
}

async function findEmailByConversationId(conversationId) {
  const accessToken = await getAccessToken()
  const helpdeskEmail = process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com'

  // Get recent messages and filter client-side (Graph API filter for conversationId is unreliable)
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${helpdeskEmail}/messages?$select=id,subject,conversationId,hasAttachments,receivedDateTime&$orderby=receivedDateTime desc&$top=200`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    }
  )

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to find email: ${response.statusText} - ${error}`)
  }

  const data = await response.json()
  return data.value && data.value.find(msg => msg.conversationId === conversationId) || null
}

async function main() {
  const ticketNumber = process.argv[2]

  if (!ticketNumber) {
    console.error('Usage: node process-ticket-attachments.js <ticketNumber>')
    process.exit(1)
  }

  console.log(`🔍 Finding ticket ${ticketNumber}...\n`)

  // Get ticket
  const ticket = await prisma.ticket.findFirst({
    where: { ticketNumber },
    select: {
      id: true,
      ticketNumber: true,
      emailConversationId: true,
      requesterId: true,
      title: true
    }
  })

  if (!ticket) {
    console.error(`❌ Ticket ${ticketNumber} not found`)
    process.exit(1)
  }

  if (!ticket.emailConversationId) {
    console.error(`❌ Ticket ${ticketNumber} was not created from an email`)
    process.exit(1)
  }

  console.log(`✅ Found ticket: ${ticket.ticketNumber} - ${ticket.title}`)
  console.log(`   Email Conversation ID: ${ticket.emailConversationId}\n`)

  console.log(`🔍 Finding email in Microsoft Graph...\n`)

  const email = await findEmailByConversationId(ticket.emailConversationId)

  if (!email) {
    console.error(`❌ Email not found in mailbox`)
    process.exit(1)
  }

  console.log(`✅ Found email: ${email.subject}`)
  console.log(`   Message ID: ${email.id}`)
  console.log(`   Has Attachments: ${email.hasAttachments}`)
  console.log(`   Received: ${email.receivedDateTime}\n`)

  if (!email.hasAttachments) {
    console.log('✅ Email has no attachments (no inline images or files)')
    process.exit(0)
  }

  console.log(`📎 Processing attachments...\n`)

  const handler = new EmailAttachmentHandler()
  const attachments = await handler.processEmailAttachments(
    email.id,
    ticket.id,
    ticket.requesterId
  )

  console.log(`\n✅ Processed ${attachments.length} attachment(s)`)

  if (attachments.length > 0) {
    console.log('\nAttachments:')
    attachments.forEach(att => {
      console.log(`  - ${att.fileName} (${att.fileSize} bytes, ${att.mimeType})`)
    })
  }

  await prisma.$disconnect()
}

main().catch(error => {
  console.error('❌ Error:', error.message)
  prisma.$disconnect()
  process.exit(1)
})
