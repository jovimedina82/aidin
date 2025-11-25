/**
 * Email Polling Starter
 *
 * ⚠️ CRITICAL: This file MUST be run with tsx (NOT plain node)
 * - Imports TypeScript modules from modules/classify/ and modules/tickets/
 * - Requires package.json "start" script to use "tsx server.js"
 * - Import paths MUST use .ts extension (e.g., '../modules/classify/email.ts')
 *
 * See lib/start-email-polling.README.md for full documentation
 */

import cron from 'node-cron';
import { prisma } from './prisma.js';
import EmailService from './services/EmailService.js';
import { emitCommentCreated } from './socket.js';

const emailService = new EmailService();
let pollingTask = null;
let isPolling = false;

/**
 * Poll inbox for new emails
 */
async function pollInbox() {
  if (!process.env.EMAIL_POLLING_ENABLED || process.env.EMAIL_POLLING_ENABLED !== 'true') {
    console.log('⏸️  Email polling disabled');
    return { processed: 0, failed: 0 };
  }

  console.log('📬 Polling inbox for new emails...');

  try {
    // Get Microsoft Graph access token
    const accessToken = await emailService.getAccessToken();

    const helpdeskEmail = process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com';

    // Fetch unread messages from inbox using fetch() API
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const filter = `isRead eq false and receivedDateTime ge ${oneWeekAgo}`;
    const select = 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,hasAttachments,internetMessageId,conversationId';
    const url = `https://graph.microsoft.com/v1.0/users/${helpdeskEmail}/messages?$filter=${encodeURIComponent(filter)}&$select=${select}&$top=50`;

    const messagesResponse = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (!messagesResponse.ok) {
      const error = await messagesResponse.text();
      throw new Error(`Failed to fetch messages: ${error}`);
    }

    const messages = await messagesResponse.json();

    console.log(`📧 Found ${messages.value.length} unread emails`);

    let processed = 0;
    let failed = 0;

    for (const message of messages.value) {
      try {
        // Check if already processed (dedupe)
        const existing = await prisma.emailIngest.findUnique({
          where: { messageId: message.internetMessageId }
        });

        if (existing) {
          console.log(`  ⏭️  Skipping duplicate: ${message.subject}`);
          // Mark as read
          await fetch(`https://graph.microsoft.com/v1.0/users/${helpdeskEmail}/messages/${message.id}`, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ isRead: true })
          });
          continue;
        }

        // Extract ticket number from subject
        const ticketMatch = message.subject.match(/\[Ticket #([A-Z]{2,3}\d{6,7})\]/i) ||
                           message.subject.match(/#([A-Z]{2,3}\d{6,7})/i);

        let ticketId = null;
        if (ticketMatch) {
          const ticketNumber = ticketMatch[1];
          const ticket = await prisma.ticket.findFirst({
            where: { ticketNumber }
          });
          if (ticket) {
            ticketId = ticket.id;
          }
        }

        // Store email in database
        const dedupeHash = `${message.internetMessageId}-${message.receivedDateTime}`;

        await prisma.emailIngest.create({
          data: {
            messageId: message.internetMessageId,
            from: message.from.emailAddress.address,
            to: message.toRecipients.map(r => r.emailAddress.address).join(', '),
            cc: message.ccRecipients?.map(r => r.emailAddress.address).join(', ') || null,
            subject: message.subject,
            html: message.body.contentType === 'html' ? message.body.content : null,
            text: message.body.contentType === 'text' ? message.body.content : null,
            snippet: message.body.content.substring(0, 200),
            dedupeHash,
            receivedAt: new Date(message.receivedDateTime),
            processedAt: new Date(),
            ticketId,
            conversationId: message.conversationId
          }
        });

        // If this is a reply to a ticket, create a ticket message
        if (ticketId) {
          const senderEmail = message.from.emailAddress.address;
          const senderName = message.from.emailAddress.name || senderEmail;

          // Create ticket message for the reply
          const ticketMessage = await prisma.ticketMessage.create({
            data: {
              ticketId,
              kind: 'email',
              authorEmail: senderEmail,
              authorName: senderName,
              html: message.body.contentType === 'html' ? message.body.content : null,
              text: message.body.contentType === 'text' ? message.body.content : message.body.content.replace(/<[^>]*>/g, ''),
              subject: message.subject,
              createdAt: new Date(message.receivedDateTime)
            }
          });

          console.log(`  ✅ Created ticket message for reply`);

          // Emit real-time socket event for email reply (use null as authorId since it's from external email)
          emitCommentCreated(ticketId, ticketMessage, null);
        } else {
          // This is a NEW email - check if it's a bounce/undeliverable message
          const senderEmail = message.from.emailAddress.address.toLowerCase();
          const emailSubject = (message.subject || '').toLowerCase();

          // Detect bounce/undeliverable emails
          const isBounce =
            senderEmail.includes('postmaster@') ||
            senderEmail.includes('mailer-daemon@') ||
            senderEmail.includes('mailer@') ||
            emailSubject.startsWith('undeliverable:') ||
            emailSubject.startsWith('delivery status notification') ||
            emailSubject.startsWith('returned mail:') ||
            emailSubject.includes('mail delivery failed') ||
            emailSubject.includes('message could not be delivered') ||
            emailSubject.includes('delivery failure') ||
            emailSubject.includes('undeliverable: support ticket');

          if (isBounce) {
            console.log(`  🚫 Skipping bounce/undeliverable message: "${message.subject}"`);
            // Mark as read and skip
            await fetch(`https://graph.microsoft.com/v1.0/users/${helpdeskEmail}/messages/${message.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ isRead: true })
            });
            processed++;
            continue;
          }

          // Block emails from the helpdesk system itself (prevents notification loop)
          if (senderEmail === helpdeskEmail.toLowerCase()) {
            console.log(`  🚫 Skipping notification email from system: "${message.subject}" (loop prevention)`);
            // Mark as read and skip
            await fetch(`https://graph.microsoft.com/v1.0/users/${helpdeskEmail}/messages/${message.id}`, {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ isRead: true })
            });
            processed++;
            continue;
          }

          // Check if sender domain is blocked
          const emailDomain = senderEmail.includes('@') ? senderEmail.split('@')[1].toLowerCase() : '';
          if (emailDomain) {
            const blockedDomain = await prisma.blockedEmailDomain.findUnique({
              where: { domain: emailDomain }
            });

            if (blockedDomain) {
              console.log(`  🚫 Blocked domain: ${emailDomain} (from: ${senderEmail})`);

              // Log to classifier feedback for tracking
              try {
                await prisma.classifierFeedback.create({
                  data: {
                    ticketId: 'BLOCKED',
                    emailFrom: senderEmail,
                    emailSubject: message.subject || '',
                    emailBody: message.body?.content || '',
                    originalCategory: null,
                    feedbackType: 'NOT_TICKET',
                    reason: `Domain blocked: ${blockedDomain.reason || 'No reason provided'}`,
                    userId: blockedDomain.blockedBy
                  }
                });
              } catch (feedbackError) {
                console.error('  ⚠️  Failed to log blocked email feedback:', feedbackError.message);
              }

              // Mark as read and skip
              await fetch(`https://graph.microsoft.com/v1.0/users/${helpdeskEmail}/messages/${message.id}`, {
                method: 'PATCH',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ isRead: true })
              });
              processed++;
              continue;
            }
          }

          // This is a NEW email - create a ticket directly
          try {
            const emailFrom = message.from.emailAddress.address;
            const emailSubject = message.subject || 'No Subject';
            const emailBody = message.body.content || '';
            const emailBodyType = message.body.contentType || 'text';

            // 1. Find or create user
            let requester = await prisma.user.findFirst({
              where: { email: emailFrom.toLowerCase() }
            });

            if (!requester) {
              // Extract name from email
              const [firstName, ...rest] = emailFrom.split('@')[0].split('.');
              const lastName = rest.join(' ') || 'User';

              requester = await prisma.user.create({
                data: {
                  email: emailFrom.toLowerCase(),
                  firstName: firstName.charAt(0).toUpperCase() + firstName.slice(1),
                  lastName: lastName.charAt(0).toUpperCase() + lastName.slice(1),
                  userType: 'Client'
                }
              });
            }

            // 2. Classify department (simple classification for now)
            const { classifyDepartmentAndTags } = await import('../modules/classify/email.ts');
            const classification = await classifyDepartmentAndTags({
              subject: emailSubject,
              text: emailBodyType === 'text' ? emailBody : '',
              html: emailBodyType === 'html' ? emailBody : '',
              from: emailFrom,
              to: helpdeskEmail
            });

            // 3. Reserve ticket ID
            const { reserveTicketId } = await import('../modules/tickets/id.ts');
            const ticketNumber = await reserveTicketId(classification.departmentCode);

            // 4. Create ticket
            const ticket = await prisma.ticket.create({
              data: {
                ticketNumber,
                title: emailSubject,
                description: emailBody,
                status: 'NEW',
                priority: 'NORMAL',
                category: classification.tags[0] || 'General',
                requesterId: requester.id,
                emailConversationId: message.conversationId
              }
            });

            // 5. Update emailIngest to link it to the ticket
            await prisma.emailIngest.update({
              where: { messageId: message.internetMessageId },
              data: { ticketId: ticket.id }
            });

            // 6. Create ticket message
            await prisma.ticketMessage.create({
              data: {
                ticketId: ticket.id,
                kind: 'email',
                authorEmail: emailFrom,
                authorName: `${requester.firstName} ${requester.lastName}`,
                html: emailBodyType === 'html' ? emailBody : null,
                text: emailBodyType === 'text' ? emailBody : emailBody.replace(/<[^>]*>/g, ''),
                subject: emailSubject
              }
            });

            // 7. Apply tags
            const { applyTagsToTicket } = await import('../modules/classify/email.ts');
            await applyTagsToTicket(ticket.id, classification.tags);

            // 8. Process CC recipients from the original email
            if (message.ccRecipients && message.ccRecipients.length > 0) {
              for (const ccRecipient of message.ccRecipients) {
                const ccEmail = ccRecipient.emailAddress.address.toLowerCase();
                const ccName = ccRecipient.emailAddress.name || null;

                // Don't add the helpdesk email itself as a CC
                if (ccEmail === helpdeskEmail.toLowerCase()) {
                  continue;
                }

                try {
                  await prisma.ticketCC.create({
                    data: {
                      ticketId: ticket.id,
                      email: ccEmail,
                      name: ccName,
                      addedBy: 'system',
                      source: 'original'
                    }
                  });
                  console.log(`  📧 Auto-captured CC recipient: ${ccName ? `${ccName} <${ccEmail}>` : ccEmail}`);
                } catch (ccError) {
                  // Ignore duplicate errors (unique constraint on ticketId + email)
                  if (ccError.code !== 'P2002') {
                    console.error(`  ⚠️  Failed to save CC recipient ${ccEmail}:`, ccError.message);
                  }
                }
              }
            }

            console.log(`  ✅ Ticket created: ${ticketNumber} (${classification.departmentCode})`);

            // 9. Send ticket created notification
            try {
              const { getEmailService } = await import('./services/EmailService.js');
              const emailService = getEmailService();
              await emailService.sendTicketCreatedEmail(ticket, emailFrom);
              console.log(`  📧 Notification sent to ${emailFrom}`);
            } catch (emailError) {
              console.error(`  ⚠️  Failed to send notification:`, emailError.message);
            }

          } catch (ticketError) {
            console.error(`  ❌ Error creating ticket:`, ticketError.message);
            console.error(ticketError.stack);
          }
        }

        // Mark as read
        await fetch(`https://graph.microsoft.com/v1.0/users/${helpdeskEmail}/messages/${message.id}`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ isRead: true })
        });

        processed++;
        console.log(`  ✅ Processed: ${message.subject}`);

      } catch (error) {
        console.error(`  ❌ Failed to process email: ${error.message}`);
        failed++;
      }
    }

    console.log(`✅ Email polling complete: ${processed} processed, ${failed} failed`);
    return { processed, failed };

  } catch (error) {
    console.error('❌ Email polling error:', error.message);
    return { processed: 0, failed: 0 };
  }
}

/**
 * Start email polling on schedule
 */
export function startEmailPolling() {
  if (process.env.EMAIL_POLLING_ENABLED !== 'true') {
    console.log('⏸️  Email polling disabled (EMAIL_POLLING_ENABLED not set to true)');
    return;
  }

  if (pollingTask) {
    console.log('⚠️  Email polling already running');
    return;
  }

  const intervalMs = parseInt(process.env.EMAIL_POLLING_INTERVAL_MS || '60000', 10);
  const intervalSeconds = Math.floor(intervalMs / 1000);

  // For intervals >= 60 seconds, use minutes instead
  let cronExpression;
  if (intervalSeconds >= 60) {
    const intervalMinutes = Math.floor(intervalSeconds / 60);
    cronExpression = `*/${intervalMinutes} * * * *`;
    console.log(`📬 Starting email polling service (every ${intervalMinutes} minute(s))...`);
  } else {
    cronExpression = `*/${intervalSeconds} * * * * *`;
    console.log(`📬 Starting email polling service (every ${intervalSeconds} seconds)...`);
  }

  pollingTask = cron.schedule(cronExpression, async () => {
    // Skip if already polling (prevent overlap)
    if (isPolling) {
      console.log('⏭️  Skipping poll - previous poll still running');
      return;
    }

    isPolling = true;

    try {
      await pollInbox();
    } catch (error) {
      console.error('❌ Polling error:', error.message);
    } finally {
      isPolling = false;
    }
  });

  pollingTask.start();
  console.log('✅ Email polling started');
}

/**
 * Stop email polling
 */
export function stopEmailPolling() {
  if (!pollingTask) {
    console.log('⚠️  Email polling not running');
    return;
  }

  pollingTask.stop();
  pollingTask = null;
  isPolling = false;

  console.log('✅ Email polling stopped');
}
