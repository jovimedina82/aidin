require('dotenv').config();
const { ConfidentialClientApplication } = require('@azure/msal-node');

async function testEmail() {
  console.log('🔐 Testing Microsoft Graph OAuth2...\n');
  console.log('Client ID:', process.env.AZURE_AD_CLIENT_ID ? '✅ SET' : '❌ NOT SET');
  console.log('Client Secret:', process.env.AZURE_AD_CLIENT_SECRET ? '✅ SET' : '❌ NOT SET');
  console.log('Tenant ID:', process.env.AZURE_AD_TENANT_ID ? '✅ SET' : '❌ NOT SET');
  console.log('');

  if (!process.env.AZURE_AD_CLIENT_ID) {
    console.error('❌ AZURE_AD_CLIENT_ID not found');
    process.exit(1);
  }

  const msalConfig = {
    auth: {
      clientId: process.env.AZURE_AD_CLIENT_ID,
      authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
    }
  };

  const msalClient = new ConfidentialClientApplication(msalConfig);

  console.log('1️⃣ Acquiring access token...');
  const response = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default']
  });

  console.log('✅ Access token acquired');
  console.log('');

  console.log('2️⃣ Sending test email...');
  const emailResponse = await fetch(`https://graph.microsoft.com/v1.0/users/helpdesk@surterreproperties.com/sendMail`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${response.accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        subject: 'Test - AI Auto-Reply System',
        body: {
          contentType: 'Text',
          content: 'This is a test email from AidIN to verify email sending works.\n\nTime: ' + new Date().toLocaleString()
        },
        toRecipients: [{
          emailAddress: {
            address: 'helpdesk@surterreproperties.com'
          }
        }]
      },
      saveToSentItems: false
    })
  });

  if (emailResponse.ok) {
    console.log('✅ Test email sent successfully!');
    console.log('🎉 Microsoft Graph Mail.Send is WORKING!');
  } else {
    const error = await emailResponse.text();
    console.log('❌ Failed to send email');
    console.log('Status:', emailResponse.status);
    console.log('Error:', error);
  }
}

testEmail().catch(console.error);
