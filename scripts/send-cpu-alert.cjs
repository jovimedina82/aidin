#!/usr/bin/env node

/**
 * Send CPU Alert Email
 * Usage: node send-cpu-alert.js <recipient-email> <report-file>
 */

const { ConfidentialClientApplication } = require('@azure/msal-node')
const fs = require('fs')
const path = require('path')

// Load environment variables from .env
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const HELPDESK_EMAIL = process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com'

const msalConfig = {
  auth: {
    clientId: process.env.AZURE_AD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}`,
    clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
  }
}

async function getAccessToken() {
  try {
    const msalClient = new ConfidentialClientApplication(msalConfig)
    const tokenRequest = {
      scopes: ['https://graph.microsoft.com/.default']
    }

    const response = await msalClient.acquireTokenByClientCredential(tokenRequest)
    return response.accessToken
  } catch (error) {
    console.error('Error getting access token:', error.message)
    throw error
  }
}

async function sendEmailAlert(recipientEmail, reportFile) {
  try {
    // Read the report content
    const reportContent = fs.readFileSync(reportFile, 'utf8')

    // Get access token
    const accessToken = await getAccessToken()

    // Get hostname
    const hostname = require('os').hostname()
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      dateStyle: 'full',
      timeStyle: 'long'
    })

    // Format email content
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
    .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f8f9fa; }
    .alert-box { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
    .report { background-color: white; border: 1px solid #ddd; padding: 15px; font-family: 'Courier New', monospace; font-size: 12px; white-space: pre-wrap; overflow-x: auto; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .metric { display: inline-block; margin: 10px 20px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #dc3545; }
    .metric-label { font-size: 12px; color: #666; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="header">
    <h1>⚠️ HIGH CPU USAGE ALERT</h1>
    <p>Server: ${hostname}</p>
  </div>

  <div class="content">
    <div class="alert-box">
      <strong>⚠️ Alert:</strong> CPU usage has exceeded the configured threshold on <strong>${hostname}</strong>
      <br><br>
      <strong>Time:</strong> ${timestamp}
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <div class="metric">
        <div class="metric-value">High CPU</div>
        <div class="metric-label">Status</div>
      </div>
    </div>

    <h3>📊 Detailed System Report</h3>
    <div class="report">${reportContent}</div>

    <div style="margin-top: 30px; padding: 15px; background-color: #e7f3ff; border-left: 4px solid #0066cc;">
      <strong>💡 Recommended Actions:</strong>
      <ul>
        <li>Review the top CPU-consuming processes in the report above</li>
        <li>Check if any processes can be optimized or need to be restarted</li>
        <li>Monitor disk I/O and memory usage for bottlenecks</li>
        <li>Consider scaling resources if high usage is sustained</li>
        <li>SSH into the server: <code>ssh root@${hostname}</code></li>
      </ul>
    </div>
  </div>

  <div class="footer">
    <p>This is an automated alert from the <strong>AidIN Helpdesk Monitoring System</strong></p>
    <p>Server: ${hostname} | Generated: ${timestamp}</p>
    <p style="color: #999;">To modify alert settings, edit <code>/opt/apps/aidin/scripts/monitor-cpu-usage.sh</code></p>
  </div>
</body>
</html>
`

    // Send email using Microsoft Graph API
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${HELPDESK_EMAIL}/sendMail`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            subject: `⚠️ HIGH CPU ALERT - ${hostname} - ${new Date().toLocaleString()}`,
            body: {
              contentType: 'HTML',
              content: htmlContent
            },
            toRecipients: [
              {
                emailAddress: {
                  address: recipientEmail
                }
              }
            ],
            importance: 'high'
          },
          saveToSentItems: true
        })
      }
    )

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Failed to send email: ${error}`)
    }

    console.log(`✅ CPU alert email sent to ${recipientEmail}`)
    return { success: true }

  } catch (error) {
    console.error('Error sending CPU alert email:', error.message)
    throw error
  }
}

// Main execution
const recipientEmail = process.argv[2]
const reportFile = process.argv[3]

if (!recipientEmail || !reportFile) {
  console.error('Usage: node send-cpu-alert.js <recipient-email> <report-file>')
  process.exit(1)
}

if (!fs.existsSync(reportFile)) {
  console.error(`Report file not found: ${reportFile}`)
  process.exit(1)
}

sendEmailAlert(recipientEmail, reportFile)
  .then(() => {
    console.log('CPU alert sent successfully')
    process.exit(0)
  })
  .catch(error => {
    console.error('Failed to send CPU alert:', error.message)
    process.exit(1)
  })
