import { createTransport } from 'nodemailer'

// Helper function to send email via SMTP
async function sendEmail(emailData) {
  try {
    if (transporter) {
      console.log('Sending email via SMTP...')
      const result = await transporter.sendMail(emailData)
      return result
    } else {
      console.error('No email transport available')
      throw new Error('SMTP email transport not configured')
    }
  } catch (error) {
    console.error('Email send error:', error)
    throw error
  }
}

// Create transporter with improved configuration and error handling
const createTransporter = () => {
  try {
    return createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS?.replace(/'/g, ''), // Remove quotes from password
      },
      tls: {
        // Use modern TLS configuration instead of deprecated SSLv3
        ciphers: 'HIGH:MEDIUM:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA',
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      debug: process.env.NODE_ENV === 'development',
      logger: process.env.NODE_ENV === 'development'
    })
  } catch (error) {
    console.error('Failed to create email transporter:', error)
    return null
  }
}

const transporter = createTransporter()

// Helper function to get FROM email configuration
function getFromAddress() {
  // Handle both SMTP_FROM format: "Name <email@domain.com>" and separate SMTP_FROM_NAME/SMTP_FROM_EMAIL
  if (process.env.SMTP_FROM) {
    return process.env.SMTP_FROM
  }

  const fromName = process.env.SMTP_FROM_NAME || 'IT Support Team'
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER

  return `"${fromName}" <${fromEmail}>`
}

// Helper function to extract email from FROM address for Message-ID
function getFromEmail() {
  if (process.env.SMTP_FROM_EMAIL) {
    return process.env.SMTP_FROM_EMAIL
  }

  if (process.env.SMTP_FROM) {
    const match = process.env.SMTP_FROM.match(/<([^>]+)>/)
    return match ? match[1] : process.env.SMTP_USER
  }

  return process.env.SMTP_USER
}

// Helper function to generate ticket URL
function getTicketUrl(ticketId) {
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://helpdesk.surterreproperties.com'
  return `${baseUrl}/tickets/${ticketId}`
}

export async function sendTicketCreatedEmail(ticket, requester) {
  try {
    // Validate required parameters
    if (!ticket || !requester || !requester.email) {
      console.error('Missing required parameters for email send:', { ticket: !!ticket, requester: !!requester, email: requester?.email })
      return false
    }

    const subject = `[#${ticket.ticketNumber}] ${ticket.title}`
    const html = `
      <h2>Ticket Created Successfully</h2>
      <p>Dear ${requester.firstName},</p>

      <p>Your support ticket has been created successfully. Here are the details:</p>

      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Ticket ID:</strong> ${ticket.ticketNumber}</p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
        <p><strong>Category:</strong> ${ticket.category || 'Not categorized'}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
      </div>

      <p><strong>Description:</strong></p>
      <p>${ticket.description}</p>

      <p>You will receive email updates when there are changes to your ticket.</p>

      <div style="margin: 20px 0; text-align: center;">
        <a href="${getTicketUrl(ticket.id)}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
          View Ticket in Helpdesk
        </a>
      </div>

      <p><em>You can also reply directly to this email to add comments to your ticket.</em></p>

      <p>Best regards,<br>
      ${process.env.SMTP_FROM_NAME || 'Helpdesk Surterre Properties'}</p>
    `

    await sendEmail({
      from: getFromAddress(),
      to: requester.email,
      subject,
      html,
      headers: {
        'Message-ID': `<${ticket.ticketNumber}-created@${getFromEmail()?.split('@')[1]}>`,
        'X-Ticket-ID': ticket.ticketNumber,
        'X-Ticket-Status': ticket.status
      }
    })

    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

export async function sendTicketAssignedEmail(ticket, assignee, requester) {
  try {
    const subject = `[#${ticket.ticketNumber}] Ticket Assigned to You`
    const html = `
      <h2>New Ticket Assignment</h2>
      <p>Dear ${assignee.firstName},</p>
      
      <p>A new ticket has been assigned to you:</p>
      
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Ticket ID:</strong> ${ticket.ticketNumber}</p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
        <p><strong>Requester:</strong> ${requester.firstName} ${requester.lastName} (${requester.email})</p>
        <p><strong>Category:</strong> ${ticket.category || 'Not categorized'}</p>
      </div>
      
      <p><strong>Description:</strong></p>
      <p>${ticket.description}</p>

      <p>Please review and respond to this ticket as soon as possible.</p>

      <div style="margin: 20px 0; text-align: center;">
        <a href="${getTicketUrl(ticket.id)}" style="background-color: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
          Open Ticket
        </a>
      </div>

      <p>Best regards,<br>
      IT Helpdesk System</p>
    `

    await sendEmail({
      from: getFromAddress(),
      to: assignee.email,
      subject,
      html,
      headers: {
        'Message-ID': `<${ticket.ticketNumber}-assigned@${getFromEmail()?.split('@')[1]}>`,
        'In-Reply-To': `<${ticket.ticketNumber}-created@${getFromEmail()?.split('@')[1]}>`,
        'References': `<${ticket.ticketNumber}-created@${getFromEmail()?.split('@')[1]}>`,
        'X-Ticket-ID': ticket.ticketNumber,
        'X-Ticket-Status': ticket.status
      }
    })

    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

export async function sendTicketCommentEmail(ticket, comment, user, requester, assignee = null) {
  try {
    // Determine who should receive the email
    const recipients = []

    // If comment is from requester, notify assignee
    if (user.id === requester.id && assignee && assignee.id !== user.id) {
      recipients.push({
        user: assignee,
        type: 'assignee',
        subject: `[#${ticket.ticketNumber}] New Response from Customer`,
        greeting: `Dear ${assignee.firstName},`,
        message: `The customer has added a new response to their ticket:`
      })
    }

    // If comment is from agent/system, notify requester (unless it's internal)
    if (user.id !== requester.id && !comment.isInternal) {
      recipients.push({
        user: requester,
        type: 'requester',
        subject: `[#${ticket.ticketNumber}] New Response to Your Ticket`,
        greeting: `Dear ${requester.firstName},`,
        message: `A new response has been added to your ticket:`
      })
    }

    // Send emails to all recipients
    for (const recipient of recipients) {
      const html = `
        <h2>${recipient.type === 'assignee' ? 'Customer Response' : 'New Response to Your Ticket'}</h2>
        <p>${recipient.greeting}</p>

        <p>${recipient.message}</p>

        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
          <p><strong>Ticket ID:</strong> ${ticket.ticketNumber}</p>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Response by:</strong> ${user.firstName} ${user.lastName}</p>
          ${recipient.type === 'assignee' ? `<p><strong>Customer:</strong> ${requester.firstName} ${requester.lastName} (${requester.email})</p>` : ''}
        </div>

        <p><strong>Response:</strong></p>
        <div style="background-color: #ffffff; padding: 10px; border-left: 3px solid #007bff;">
          ${comment.content.replace(/\n/g, '<br>')}
        </div>

        <div style="margin: 20px 0; text-align: center;">
          <a href="${getTicketUrl(ticket.id)}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
            View Ticket Thread
          </a>
        </div>

        <p><em>You can reply directly to this email to add comments to your ticket.</em></p>

        <p>Best regards,<br>
        ${process.env.SMTP_FROM_NAME || 'Helpdesk Surterre Properties'}</p>
      `

      await sendEmail({
        from: getFromAddress(),
        to: recipient.user.email,
        subject: recipient.subject,
        html,
        headers: {
          'Message-ID': `<${ticket.ticketNumber}-${comment.id}@${getFromEmail()?.split('@')[1]}>`,
          'In-Reply-To': `<${ticket.ticketNumber}-created@${getFromEmail()?.split('@')[1]}>`,
          'References': `<${ticket.ticketNumber}-created@${getFromEmail()?.split('@')[1]}>`,
          'X-Ticket-ID': ticket.ticketNumber,
          'X-Comment-ID': comment.id,
          'X-Ticket-Status': ticket.status
        }
      })
    }

    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

export async function sendAIResponseEmail(ticket, comment, requester) {
  try {
    const subject = `[#${ticket.ticketNumber}] Automated Response to Your Ticket`
    const html = `
      <h2>Automated Response to Your Ticket</h2>
      <p>Dear ${requester.firstName},</p>

      <p>We've received your support ticket and our AI assistant has provided an initial response:</p>

      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Ticket ID:</strong> ${ticket.ticketNumber}</p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
      </div>

      <p><strong>AI Response:</strong></p>
      <div style="background-color: #e8f4fd; padding: 15px; border-left: 4px solid #007bff; border-radius: 5px;">
        ${comment.content.replace(/\n/g, '<br>')}
      </div>

      <p>If this response doesn't fully address your issue, our support team will review your ticket and provide additional assistance shortly.</p>

      <div style="margin: 20px 0; text-align: center;">
        <a href="${getTicketUrl(ticket.id)}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
          View Ticket Thread
        </a>
      </div>

      <p><em>You can reply directly to this email to add comments to your ticket.</em></p>

      <p>Best regards,<br>
      ${process.env.SMTP_FROM_NAME || 'Helpdesk Surterre Properties'}</p>
    `

    await sendEmail({
      from: getFromAddress(),
      to: requester.email,
      subject,
      html,
      headers: {
        'Message-ID': `<${ticket.ticketNumber}-ai-${comment.id}@${getFromEmail()?.split('@')[1]}>`,
        'In-Reply-To': `<${ticket.ticketNumber}-created@${getFromEmail()?.split('@')[1]}>`,
        'References': `<${ticket.ticketNumber}-created@${getFromEmail()?.split('@')[1]}>`,
        'X-Ticket-ID': ticket.ticketNumber,
        'X-Comment-ID': comment.id,
        'X-Ticket-Status': ticket.status,
        'X-Auto-Response': 'true'
      }
    })

    return true
  } catch (error) {
    console.error('AI email send error:', error)
    return false
  }
}

export async function sendTicketCreatedWithAIResponseEmail(ticket, aiComment, requester) {
  try {
    const subject = `[#${ticket.ticketNumber}] ${ticket.title}`
    const html = `
      <h2>Ticket Created Successfully</h2>
      <p>Dear ${requester.firstName},</p>

      <p>Your support ticket has been created successfully. Here are the details:</p>

      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0;">
        <p><strong>Ticket ID:</strong> ${ticket.ticketNumber}</p>
        <p><strong>Title:</strong> ${ticket.title}</p>
        <p><strong>Priority:</strong> ${ticket.priority}</p>
        <p><strong>Category:</strong> ${ticket.category || 'Not categorized'}</p>
        <p><strong>Status:</strong> ${ticket.status}</p>
      </div>

      <p><strong>Your Request:</strong></p>
      <p>${ticket.description}</p>

      <hr style="border: none; border-top: 2px solid #007bff; margin: 30px 0;">

      <h3 style="color: #007bff;">🤖 Automated Response from Aiden</h3>
      <p>Our AI assistant has provided an initial response to help you:</p>

      <div style="background-color: #e8f4fd; padding: 15px; border-left: 4px solid #007bff; border-radius: 5px; margin: 15px 0;">
        ${aiComment.content.replace(/\n/g, '<br>')}
      </div>

      <p>If this response doesn't fully address your issue, our support team will review your ticket and provide additional assistance shortly.</p>

      <div style="margin: 20px 0; text-align: center;">
        <a href="${getTicketUrl(ticket.id)}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
          View Ticket Thread
        </a>
      </div>

      <p><em>You can reply directly to this email to add comments to your ticket.</em></p>

      <p>Best regards,<br>
      ${process.env.SMTP_FROM_NAME || 'Helpdesk Surterre Properties'}</p>
    `

    await sendEmail({
      from: getFromAddress(),
      to: requester.email,
      subject,
      html,
      headers: {
        'Message-ID': `<${ticket.ticketNumber}-created-with-ai@${getFromEmail()?.split('@')[1]}>`,
        'X-Ticket-ID': ticket.ticketNumber,
        'X-Comment-ID': aiComment.id,
        'X-Ticket-Status': ticket.status,
        'X-Combined-Email': 'true'
      }
    })

    return true
  } catch (error) {
    console.error('Combined email send error:', error)
    return false
  }
}