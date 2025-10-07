#!/usr/bin/env node

/**
 * Test Microsoft Graph OAuth2 credentials and permissions
 */

import { ConfidentialClientApplication } from '@azure/msal-node'

async function testGraphAuth() {
  console.log('🔐 Testing Microsoft Graph OAuth2 Authentication...\n');

  try {
    // Load environment variables
    const clientId = process.env.AZURE_AD_CLIENT_ID;
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET;
    const tenantId = process.env.AZURE_AD_TENANT_ID;
    const helpdeskEmail = process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com';

    console.log('Config:');
    console.log('  Client ID:', clientId);
    console.log('  Tenant ID:', tenantId);
    console.log('  Helpdesk Email:', helpdeskEmail);
    console.log('');

    // Initialize MSAL
    const msalConfig = {
      auth: {
        clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        clientSecret,
      }
    };

    const msalClient = new ConfidentialClientApplication(msalConfig);

    // Get access token
    console.log('1️⃣ Requesting access token...');
    const tokenRequest = {
      scopes: ['https://graph.microsoft.com/.default']
    };

    const response = await msalClient.acquireTokenByClientCredential(tokenRequest);

    if (!response || !response.accessToken) {
      throw new Error('Failed to get access token');
    }

    console.log('✅ Access token acquired');
    console.log('   Token Type:', response.tokenType);
    console.log('   Expires:', new Date(response.expiresOn).toLocaleString());
    console.log('');

    // Test permissions - Get mailbox
    console.log('2️⃣ Testing mailbox access...');
    const mailboxResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${helpdeskEmail}`,
      {
        headers: {
          Authorization: `Bearer ${response.accessToken}`
        }
      }
    );

    if (!mailboxResponse.ok) {
      const error = await mailboxResponse.text();
      throw new Error(`Failed to access mailbox: ${error}`);
    }

    const mailboxData = await mailboxResponse.json();
    console.log('✅ Mailbox access successful');
    console.log('   Email:', mailboxData.mail || mailboxData.userPrincipalName);
    console.log('   Display Name:', mailboxData.displayName);
    console.log('');

    // Test read permissions - Get inbox messages
    console.log('3️⃣ Testing inbox read access...');
    const messagesResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${helpdeskEmail}/mailFolders/inbox/messages?$top=1`,
      {
        headers: {
          Authorization: `Bearer ${response.accessToken}`
        }
      }
    );

    if (!messagesResponse.ok) {
      const error = await messagesResponse.text();
      throw new Error(`Failed to read inbox: ${error}`);
    }

    const messagesData = await messagesResponse.json();
    console.log('✅ Inbox read access successful');
    console.log('   Total messages found:', messagesData['@odata.count'] || messagesData.value?.length || 'N/A');
    console.log('');

    // Test send permissions - Check if we can send mail
    console.log('4️⃣ Testing send mail permissions...');

    // We'll try to send to ourselves as a test
    const testEmailResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${helpdeskEmail}/sendMail`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${response.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            subject: 'AidIN Test - Email Sending Verification',
            body: {
              contentType: 'Text',
              content: 'This is an automated test email from the AidIN helpdesk system to verify that AI auto-reply email sending is working correctly.\n\nIf you receive this email, OAuth2 credentials and Mail.Send permissions are configured correctly.\n\nTime: ' + new Date().toLocaleString()
            },
            toRecipients: [
              {
                emailAddress: {
                  address: helpdeskEmail
                }
              }
            ]
          },
          saveToSentItems: false
        })
      }
    );

    if (!testEmailResponse.ok) {
      const error = await testEmailResponse.text();
      console.log('❌ Send mail permission check failed');
      console.log('   Error:', error);
      console.log('\n⚠️  You need to grant Mail.Send permission to the app');
      console.log('   Go to Azure Portal → App Registration → API Permissions');
      console.log('   Add: Mail.Send (Application permission)');
      console.log('');
    } else {
      console.log('✅ Send mail permission verified');
      console.log('   Test email sent to:', helpdeskEmail);
      console.log('');
    }

    console.log('\n📊 Summary:');
    console.log('✅ OAuth2 authentication: WORKING');
    console.log('✅ Mailbox access: WORKING');
    console.log('✅ Inbox read: WORKING');
    console.log(testEmailResponse.ok ? '✅ Mail send: WORKING' : '❌ Mail send: FAILED - Permission needed');
    console.log('\n🎉 Microsoft Graph API connection is ' + (testEmailResponse.ok ? 'fully configured!' : 'partially configured (add Mail.Send permission)'));

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Check .env file has correct Azure AD credentials');
    console.log('2. Verify app has required permissions in Azure Portal');
    console.log('3. Required permissions:');
    console.log('   - Mail.Read (Application)');
    console.log('   - Mail.Send (Application)');
    console.log('   - Mail.ReadWrite (Application)');
    process.exit(1);
  }
}

testGraphAuth();
