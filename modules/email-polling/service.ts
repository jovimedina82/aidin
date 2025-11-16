/**
 * Email Polling Service
 *
 * Polls Microsoft 365 inbox, classifies emails, creates tickets, and handles replies.
 * Replaces N8N workflow automation with native TypeScript implementation.
 *
 * @module modules/email-polling/service
 */

import { ConfidentialClientApplication } from '@azure/msal-node';
import { prisma } from '@/lib/prisma';
import { classifyEmail, EmailClassificationResult } from './classification';
import { extractTicketId } from '@/modules/tickets/subject';

export interface EmailPollingStats {
  total: number;
  success: number;
  failed: number;
  support: number;
  vendor: number;
  unclear: number;
  lastPoll: Date | null;
  lastSuccess: Date | null;
  isRunning: boolean;
}

export interface GraphEmail {
  id: string;
  subject: string;
  from: {
    emailAddress: {
      address: string;
      name?: string;
    };
  };
  toRecipients?: Array<{
    emailAddress: {
      address: string;
      name?: string;
    };
  }>;
  body: {
    content: string;
    contentType: 'text' | 'html';
  };
  bodyPreview?: string;
  receivedDateTime: string;
  isRead: boolean;
  conversationId: string;
  internetMessageId?: string;
  inReplyTo?: string | null;
  references?: string | null;
}

/**
 * Email Polling Service Class
 */
export class EmailPollingService {
  private msalClient: ConfidentialClientApplication;
  private helpdeskEmail: string;
  private isRunning: boolean = false;
  private stats: EmailPollingStats;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    const msalConfig = {
      auth: {
        clientId: process.env.AZURE_AD_CLIENT_ID!,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
        clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      },
    };

    this.msalClient = new ConfidentialClientApplication(msalConfig);
    this.helpdeskEmail = process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com';

    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      support: 0,
      vendor: 0,
      unclear: 0,
      lastPoll: null,
      lastSuccess: null,
      isRunning: false,
    };
  }

  /**
   * Get Microsoft Graph access token (cached for 55 minutes)
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if still valid (with 5-minute buffer)
    if (this.accessToken && now < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    try {
      const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default'],
      };

      const response = await this.msalClient.acquireTokenByClientCredential(tokenRequest);

      if (!response || !response.accessToken) {
        throw new Error('Failed to acquire access token');
      }

      this.accessToken = response.accessToken;
      // Tokens typically last 60 minutes, cache for 55
      this.tokenExpiry = now + 55 * 60 * 1000;

      console.log('✅ Microsoft Graph access token acquired');
      return this.accessToken;
    } catch (error: any) {
      console.error('❌ Failed to get access token:', error.message);
      throw new Error(`Failed to get access token: ${error.message}`);
    }
  }

  /**
   * Fetch unread emails from Microsoft Graph
   */
  private async fetchUnreadEmails(batchSize: number = 10): Promise<GraphEmail[]> {
    let accessToken = await this.getAccessToken();

    const url =
      `https://graph.microsoft.com/v1.0/users/${this.helpdeskEmail}/mailFolders/inbox/messages` +
      `?$filter=isRead eq false` +
      `&$top=${batchSize}` +
      `&$orderby=receivedDateTime desc` +
      `&$select=id,subject,from,toRecipients,body,bodyPreview,receivedDateTime,isRead,conversationId,internetMessageId`;

    try {
      let response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // If 401, clear cache and retry with fresh token
      if (response.status === 401) {
        console.log('🔄 Token expired, refreshing...');
        this.accessToken = null;
        this.tokenExpiry = 0;
        accessToken = await this.getAccessToken();

        response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
      }

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Graph API error:`, {
          status: response.status,
          error,
          helpdeskEmail: this.helpdeskEmail,
          url
        });
        throw new Error(`Graph API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const emails = data.value || [];

      console.log(`📬 Fetched ${emails.length} unread email(s) from inbox`);

      // Log details about fetched emails for debugging
      if (emails.length > 0) {
        emails.forEach((email: GraphEmail) => {
          console.log(`  - From: ${email.from.emailAddress.address}, Subject: "${email.subject}", Received: ${email.receivedDateTime}`);
        });
      }

      return emails;
    } catch (error: any) {
      console.error('❌ Failed to fetch emails:', error.message);
      throw error;
    }
  }

  /**
   * Check if email is a reply to existing ticket
   */
  private isReplyEmail(email: GraphEmail): { isReply: boolean; ticketNumber: string | null } {
    const subject = email.subject || '';

    // Extract ticket number from subject using regex
    // Matches: [Ticket #IT000006], [#IT000006], [IT000006]
    const ticketMatch = subject.match(/\[(?:Ticket )?#?([A-Z]{2,3}\d{6})\]/i);

    return {
      isReply: !!ticketMatch,
      ticketNumber: ticketMatch ? ticketMatch[1].toUpperCase() : null,
    };
  }

  /**
   * Process reply email - post to reply endpoint
   */
  private async processReplyEmail(email: GraphEmail, ticketNumber: string): Promise<void> {
    console.log(`📧 Processing reply for ticket ${ticketNumber} from ${email.from.emailAddress.address}`);

    // Fetch attachments from Graph API
    const attachments = await this.fetchAttachments(email.id);

    if (attachments.length > 0) {
      console.log(`📎 Found ${attachments.length} attachment(s) for reply`);
    }

    const to = email.toRecipients?.[0]?.emailAddress?.address || this.helpdeskEmail;

    const payload = {
      ticketNumber,
      messageId: email.internetMessageId || email.id,
      from: email.from.emailAddress.address,
      to,
      subject: email.subject || '',
      text: email.body?.content || email.bodyPreview || '',
      html: email.body?.content || '',
      conversationId: email.conversationId,
      inReplyTo: email.inReplyTo,
      attachments,
    };

    try {
      // Try reply endpoint
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3011}`;
      const response = await fetch(`${baseUrl}/api/inbound/email-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.REPLY_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SECRET || '',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 404) {
        console.log(`⚠️  Reply endpoint returned 404, trying fallback with ticketNumber...`);

        // Fallback: Try with ticketNumber query param
        const fallbackResponse = await fetch(
          `${baseUrl}/api/inbound/email-reply?resolveBy=ticketNumber`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-webhook-secret': process.env.REPLY_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SECRET || '',
              'x-resolve-by': 'ticketNumber',
            },
            body: JSON.stringify(payload),
          }
        );

        if (!fallbackResponse.ok) {
          throw new Error(`Fallback also failed: ${fallbackResponse.status}`);
        }

        console.log(`✅ Reply processed via fallback for ticket ${ticketNumber}`);
      } else if (!response.ok) {
        const error = await response.text();
        throw new Error(`Reply endpoint error: ${response.status} - ${error}`);
      } else {
        console.log(`✅ Reply processed for ticket ${ticketNumber}`);
      }

      this.stats.success++;
    } catch (error: any) {
      console.error(`❌ Failed to process reply for ticket ${ticketNumber}:`, error.message);
      this.stats.failed++;
      throw error;
    }
  }

  /**
   * Process new email - classify and create ticket if support
   */
  private async processNewEmail(email: GraphEmail): Promise<void> {
    console.log(`📧 Processing new email from ${email.from.emailAddress.address}: ${email.subject}`);

    try {
      // Early rejection for bounce/undeliverable messages
      const senderEmail = email.from.emailAddress.address.toLowerCase();
      const subject = (email.subject || '').toLowerCase();

      // Detect bounce/undeliverable emails
      const isBounce =
        senderEmail.includes('postmaster@') ||
        senderEmail.includes('mailer-daemon@') ||
        senderEmail.includes('mailer@') ||
        subject.startsWith('undeliverable:') ||
        subject.startsWith('delivery status notification') ||
        subject.startsWith('returned mail:') ||
        subject.includes('mail delivery failed') ||
        subject.includes('message could not be delivered') ||
        subject.includes('delivery failure') ||
        subject.includes('undeliverable: support ticket');

      if (isBounce) {
        console.log(`🚫 Rejecting bounce/undeliverable message: "${email.subject}"`);

        // Log to DLQ for tracking
        await prisma.emailDLQ.create({
          data: {
            messageId: email.internetMessageId || email.id,
            from: email.from.emailAddress.address,
            subject: email.subject || '',
            error: 'REJECTED_BOUNCE_MESSAGE',
            rawPayload: JSON.stringify({
              reason: 'Bounce/undeliverable message automatically rejected',
              sender: senderEmail,
            }),
          },
        });

        console.log(`✅ Bounce message rejected and logged`);
        this.stats.vendor++;
        this.stats.success++;
        return; // Skip creating ticket
      }

      // Classify email
      const classification: EmailClassificationResult = await classifyEmail({
        from: email.from.emailAddress.address,
        subject: email.subject || '',
        body: email.body?.content || email.bodyPreview || '',
        bodyPreview: email.bodyPreview,
      });

      console.log(
        `🤖 Classification: ${classification.class} (confidence: ${classification.confidence.toFixed(2)}, method: ${classification.method})`
      );

      // Update stats
      if (classification.class === 'support') {
        this.stats.support++;
      } else if (classification.class === 'vendor') {
        this.stats.vendor++;
      } else {
        this.stats.unclear++;
      }

      // Route based on classification
      if (classification.class === 'support') {
        await this.createTicket(email, classification);
      } else if (classification.class === 'vendor') {
        await this.archiveVendorEmail(email, classification);
      } else {
        // unclear - create review ticket
        await this.createReviewTicket(email, classification);
      }

      this.stats.success++;
    } catch (error: any) {
      console.error(`❌ Failed to process new email:`, error.message);
      this.stats.failed++;
      throw error;
    }
  }

  /**
   * Fetch attachments from Microsoft Graph API
   */
  private async fetchAttachments(emailId: string): Promise<any[]> {
    try {
      const accessToken = await this.getAccessToken();
      const attachmentsUrl = `https://graph.microsoft.com/v1.0/users/${this.helpdeskEmail}/messages/${emailId}/attachments`;

      const response = await fetch(attachmentsUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Graph API error fetching attachments: ${response.status} - ${error}`);
        return [];
      }

      const data = await response.json();
      const attachments = data.value || [];

      // Transform to expected format with base64 content
      return attachments
        .filter((att: any) => att['@odata.type'] === '#microsoft.graph.fileAttachment')
        .map((att: any) => ({
          filename: att.name,
          contentType: att.contentType,
          size: att.size,
          base64: att.contentBytes, // Already base64 encoded
          inline: att.isInline || false,
          cid: att.contentId || null,
        }));
    } catch (error: any) {
      console.error('Failed to fetch attachments:', error.message);
      return [];
    }
  }

  /**
   * Create support ticket from email
   */
  private async createTicket(email: GraphEmail, classification: EmailClassificationResult): Promise<void> {
    // Fetch attachments from Graph API
    const attachments = await this.fetchAttachments(email.id);

    if (attachments.length > 0) {
      console.log(`📎 Found ${attachments.length} attachment(s) for email ${email.id}`);
    }

    const payload = {
      messageId: email.internetMessageId || email.id,
      from: email.from.emailAddress.address,
      to: this.helpdeskEmail,
      subject: email.subject || '',
      text: email.body?.content || email.bodyPreview || '',
      html: email.body?.content || '',
      conversationId: email.conversationId,
      attachments,
    };

    try {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3011}`;
      const response = await fetch(`${baseUrl}/api/inbound/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET || '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ticket creation failed: ${response.status} - ${error}`);
      }

      const result = await response.json();
      console.log(`✅ Ticket created: ${result.ticketNumber} (${classification.class}, confidence: ${classification.confidence.toFixed(2)})`);
    } catch (error: any) {
      console.error(`❌ Failed to create ticket:`, error.message);
      throw error;
    }
  }

  /**
   * Archive vendor email (no ticket created)
   */
  private async archiveVendorEmail(email: GraphEmail, classification: EmailClassificationResult): Promise<void> {
    console.log(`📁 Archiving vendor email: ${email.subject} (${classification.reason})`);

    // Log to email_dlq for tracking (not a real error, just archiving)
    try {
      await prisma.emailDLQ.create({
        data: {
          messageId: email.internetMessageId || email.id,
          from: email.from.emailAddress.address,
          subject: email.subject || '',
          error: 'ARCHIVED_VENDOR',
          rawPayload: JSON.stringify({
            classification: classification.class,
            reason: classification.reason,
            confidence: classification.confidence,
          }),
        },
      });
    } catch (error: any) {
      console.error('Failed to log vendor email:', error.message);
    }

    console.log(`✅ Vendor email archived`);
  }

  /**
   * Create review ticket for unclear emails
   */
  private async createReviewTicket(email: GraphEmail, classification: EmailClassificationResult): Promise<void> {
    console.log(`⚠️  Creating review ticket for unclear email: ${email.subject}`);

    // Fetch attachments from Graph API
    const attachments = await this.fetchAttachments(email.id);

    if (attachments.length > 0) {
      console.log(`📎 Found ${attachments.length} attachment(s) for review ticket`);
    }

    const payload = {
      messageId: email.internetMessageId || email.id,
      from: email.from.emailAddress.address,
      to: this.helpdeskEmail,
      subject: `[REVIEW NEEDED] ${email.subject || '(no subject)'}`,
      text: `** This email needs manual classification **\n\nReason: ${classification.reason}\nConfidence: ${classification.confidence.toFixed(2)}\n\n---\n\n${email.body?.content || email.bodyPreview || ''}`,
      html: email.body?.content || '',
      conversationId: email.conversationId,
      attachments,
    };

    try {
      const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3011}`;
      const response = await fetch(`${baseUrl}/api/inbound/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET || '',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Review ticket creation failed: ${response.status}`);
      }

      const result = await response.json();
      console.log(`✅ Review ticket created: ${result.ticketNumber}`);
    } catch (error: any) {
      console.error(`❌ Failed to create review ticket:`, error.message);
      throw error;
    }
  }

  /**
   * Mark email as read in Microsoft 365
   */
  private async markAsRead(emailId: string): Promise<void> {
    if (process.env.EMAIL_AUTO_MARK_READ === 'false') {
      return; // Skip if auto-mark disabled
    }

    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(
        `https://graph.microsoft.com/v1.0/users/${this.helpdeskEmail}/messages/${emailId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isRead: true }),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to mark as read: ${response.status}`);
      }

      console.log(`✅ Email marked as read: ${emailId}`);
    } catch (error: any) {
      // Don't fail the whole process if mark-read fails
      console.warn(`⚠️  Failed to mark email as read (non-critical):`, error.message);
    }
  }

  /**
   * Process a single email
   */
  private async processEmail(email: GraphEmail): Promise<void> {
    const emailId = email.id;

    try {
      // Check if reply
      const { isReply, ticketNumber } = this.isReplyEmail(email);

      if (isReply && ticketNumber) {
        await this.processReplyEmail(email, ticketNumber);
      } else {
        await this.processNewEmail(email);
      }

      // Mark as read after successful processing
      await this.markAsRead(emailId);

      this.stats.total++;
      this.stats.lastSuccess = new Date();
    } catch (error: any) {
      console.error(`❌ Failed to process email ${emailId}:`, error.message);

      // Log to DLQ
      try {
        await prisma.emailDLQ.create({
          data: {
            messageId: email.internetMessageId || emailId,
            from: email.from.emailAddress.address,
            subject: email.subject || '',
            error: error.message,
            stackTrace: error.stack,
            rawPayload: JSON.stringify(email),
          },
        });
      } catch (dlqError: any) {
        console.error('Failed to log to DLQ:', dlqError.message);
      }

      // Mark as read even on failure to prevent infinite retry loop
      const autoMarkRead = process.env.EMAIL_AUTO_MARK_READ !== 'false';
      if (autoMarkRead) {
        try {
          await this.markAsRead(emailId);
          console.log(`✅ Failed email marked as read (sent to DLQ)`);
        } catch (markError: any) {
          console.error('Failed to mark failed email as read:', markError.message);
        }
      }

      throw error;
    }
  }

  /**
   * Poll inbox once
   */
  public async poll(): Promise<{ processed: number; failed: number }> {
    this.stats.lastPoll = new Date();

    const batchSize = parseInt(process.env.EMAIL_POLLING_BATCH_SIZE || '10', 10);

    console.log(`\n📬 Polling inbox for unread emails (batch size: ${batchSize})...`);

    try {
      // Fetch unread emails
      const emails = await this.fetchUnreadEmails(batchSize);

      if (emails.length === 0) {
        console.log('✅ No unread emails found');
        return { processed: 0, failed: 0 };
      }

      console.log(`📧 Found ${emails.length} unread email(s)`);

      let processed = 0;
      let failed = 0;

      // Process each email sequentially
      for (const email of emails) {
        try {
          await this.processEmail(email);
          processed++;
        } catch (error) {
          failed++;
        }
      }

      console.log(`✅ Polling complete: ${processed} processed, ${failed} failed\n`);

      return { processed, failed };
    } catch (error: any) {
      console.error(`❌ Polling failed:`, error.message);
      throw error;
    }
  }

  /**
   * Get current stats
   */
  public getStats(): EmailPollingStats {
    return {
      ...this.stats,
      isRunning: this.isRunning,
    };
  }

  /**
   * Set running status
   */
  public setRunning(running: boolean): void {
    this.isRunning = running;
    this.stats.isRunning = running;
  }
}

// Singleton instance
let emailPollingService: EmailPollingService | null = null;

/**
 * Get or create Email Polling Service instance
 */
export function getEmailPollingService(): EmailPollingService {
  if (!emailPollingService) {
    emailPollingService = new EmailPollingService();
  }
  return emailPollingService;
}
