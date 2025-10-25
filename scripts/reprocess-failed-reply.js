import { prisma } from '../lib/prisma.js';
import { ConfidentialClientApplication } from '@azure/msal-node';

const EMAIL_ID = 'AAMkADc2OTY3MDFkLTA5ZGItNGFiOS05ZjRjLWFkYTYzMWVlYmMzNwBGAAAAAACVfMgZ_9x_R5Cy8ovjhR1TBwCnXqCAKgW8TrzjrGP697vKAAAACZZFAADbkQCVEWlPSbcBkmPVPNA6AAfQ1ghnAAA=';
const HELPDESK_EMAIL = process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com';

async function getAccessToken() {
  const msalConfig = {
    auth: {
      clientId: process.env.AZURE_AD_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    },
  };

  const msalClient = new ConfidentialClientApplication(msalConfig);

  const tokenRequest = {
    scopes: ['https://graph.microsoft.com/.default'],
  };

  const response = await msalClient.acquireTokenByClientCredential(tokenRequest);

  if (!response || !response.accessToken) {
    throw new Error('Failed to acquire access token');
  }

  return response.accessToken;
}

async function fetchEmail(emailId, accessToken) {
  const url = `https://graph.microsoft.com/v1.0/users/${HELPDESK_EMAIL}/messages/${emailId}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch email: ${response.status} - ${error}`);
  }

  return await response.json();
}

async function fetchAttachments(emailId, accessToken) {
  const attachmentsUrl = `https://graph.microsoft.com/v1.0/users/${HELPDESK_EMAIL}/messages/${emailId}/attachments`;

  const response = await fetch(attachmentsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    console.log('No attachments or failed to fetch');
    return [];
  }

  const data = await response.json();
  const attachments = data.value || [];

  return attachments
    .filter((att) => att['@odata.type'] === '#microsoft.graph.fileAttachment')
    .map((att) => ({
      filename: att.name,
      contentType: att.contentType,
      size: att.size,
      base64: att.contentBytes,
      inline: att.isInline || false,
      cid: att.contentId || null,
    }));
}

async function processReply(email, attachments) {
  // Extract ticket number from subject
  const subject = email.subject || '';
  const ticketMatch = subject.match(/\[(?:Ticket )?#?([A-Z]{2,3}\d{6})\]/i);

  if (!ticketMatch) {
    throw new Error('Could not extract ticket number from subject');
  }

  const ticketNumber = ticketMatch[1].toUpperCase();
  console.log(`\nExtracted ticket number: ${ticketNumber}`);

  const payload = {
    ticketNumber,
    messageId: email.internetMessageId || email.id,
    from: email.from.emailAddress.address,
    to: email.toRecipients?.[0]?.emailAddress?.address || HELPDESK_EMAIL,
    subject: email.subject || '',
    text: email.body?.content || email.bodyPreview || '',
    html: email.body?.content || '',
    conversationId: email.conversationId,
    inReplyTo: email.inReplyTo,
    attachments,
  };

  console.log('\nProcessing reply through API...');
  console.log(`  From: ${payload.from}`);
  console.log(`  Subject: ${payload.subject}`);
  console.log(`  Ticket: ${ticketNumber}`);
  console.log(`  Attachments: ${attachments.length}`);

  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3011}`;
  const response = await fetch(`${baseUrl}/api/inbound/email-reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-secret': process.env.REPLY_WEBHOOK_SECRET || process.env.N8N_WEBHOOK_SECRET || '',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Reply processing failed: ${response.status} - ${error}`);
  }

  const result = await response.json();
  console.log('\n✅ Reply processed successfully!');
  console.log('Result:', JSON.stringify(result, null, 2));

  return result;
}

async function markDLQAsResolved(messageId) {
  console.log(`\nMarking DLQ entries as resolved for message: ${messageId}`);

  const updated = await prisma.emailDLQ.updateMany({
    where: {
      messageId,
      resolved: false,
    },
    data: {
      resolved: true,
      resolvedAt: new Date(),
      resolvedBy: 'manual-reprocess-script',
      resolutionNote: 'Manually reprocessed after database connection pool fix',
    },
  });

  console.log(`✅ Marked ${updated.count} DLQ entries as resolved`);
}

async function main() {
  try {
    console.log('=== Reprocessing Failed Reply for GN000011 ===\n');
    console.log(`Email ID: ${EMAIL_ID}\n`);

    // Get access token
    console.log('1. Getting Microsoft Graph access token...');
    const accessToken = await getAccessToken();
    console.log('✅ Access token acquired');

    // Fetch email
    console.log('\n2. Fetching email from Microsoft Graph...');
    const email = await fetchEmail(EMAIL_ID, accessToken);
    console.log('✅ Email fetched');
    console.log(`   From: ${email.from.emailAddress.address}`);
    console.log(`   Subject: ${email.subject}`);
    console.log(`   Received: ${email.receivedDateTime}`);

    // Fetch attachments
    console.log('\n3. Fetching attachments...');
    const attachments = await fetchAttachments(EMAIL_ID, accessToken);
    console.log(`✅ Found ${attachments.length} attachment(s)`);

    // Process reply
    console.log('\n4. Processing reply...');
    const result = await processReply(email, attachments);

    // Mark DLQ as resolved
    console.log('\n5. Updating DLQ...');
    await markDLQAsResolved(email.internetMessageId);

    console.log('\n=== SUCCESS ===');
    console.log('The reply has been successfully posted to ticket GN000011!');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
