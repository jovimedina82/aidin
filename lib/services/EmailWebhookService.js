import { ConfidentialClientApplication } from '@azure/msal-node'

class EmailWebhookService {
  constructor() {
    this.msalConfig = {
      auth: {
        clientId: process.env.MICROSOFT_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`,
        clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      }
    }

    this.msalClient = new ConfidentialClientApplication(this.msalConfig)
    this.subscriptionId = null
    this.webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/graph-email`
  }

  async getAccessToken() {
    try {
      const tokenRequest = {
        scopes: ['https://graph.microsoft.com/.default']
      }

      const response = await this.msalClient.acquireTokenByClientCredential(tokenRequest)
      return response.accessToken
    } catch (error) {
      console.error('Error getting access token:', error)
      throw error
    }
  }

  async createSubscription() {
    try {
      const accessToken = await this.getAccessToken()
      const mailboxEmail = process.env.HELPDESK_EMAIL || 'helpdesk@surterreproperties.com'

      // Create subscription for new emails in inbox
      const subscription = {
        changeType: 'created',
        notificationUrl: this.webhookUrl,
        resource: `users/${mailboxEmail}/mailFolders/inbox/messages`,
        expirationDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        clientState: process.env.GRAPH_WEBHOOK_SECRET || 'aidin-helpdesk-secret-key'
      }

      const response = await fetch('https://graph.microsoft.com/v1.0/subscriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(subscription)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Failed to create subscription: ${JSON.stringify(error)}`)
      }

      const subscriptionData = await response.json()
      this.subscriptionId = subscriptionData.id

      console.log('✅ Microsoft Graph email subscription created:', {
        id: subscriptionData.id,
        resource: subscriptionData.resource,
        expiresAt: subscriptionData.expirationDateTime
      })

      return subscriptionData
    } catch (error) {
      console.error('Error creating email webhook subscription:', error)
      throw error
    }
  }

  async renewSubscription() {
    if (!this.subscriptionId) {
      console.warn('No subscription ID to renew, creating new subscription')
      return this.createSubscription()
    }

    try {
      const accessToken = await this.getAccessToken()

      const renewal = {
        expirationDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }

      const response = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${this.subscriptionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(renewal)
      })

      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to renew subscription, creating new one:', error)
        return this.createSubscription()
      }

      const subscriptionData = await response.json()
      console.log('✅ Email subscription renewed:', {
        id: subscriptionData.id,
        expiresAt: subscriptionData.expirationDateTime
      })

      return subscriptionData
    } catch (error) {
      console.error('Error renewing subscription:', error)
      // Try to create a new subscription if renewal fails
      return this.createSubscription()
    }
  }

  async deleteSubscription() {
    if (!this.subscriptionId) {
      return
    }

    try {
      const accessToken = await this.getAccessToken()

      const response = await fetch(`https://graph.microsoft.com/v1.0/subscriptions/${this.subscriptionId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (response.ok) {
        console.log('✅ Email subscription deleted:', this.subscriptionId)
        this.subscriptionId = null
      }
    } catch (error) {
      console.error('Error deleting subscription:', error)
    }
  }

  async startAutoRenewal() {
    // Renew subscription every 12 hours (subscriptions last 24 hours)
    const renewalInterval = 12 * 60 * 60 * 1000

    const renewTask = async () => {
      try {
        await this.renewSubscription()
      } catch (error) {
        console.error('Auto-renewal failed:', error)
      }
    }

    // Initial creation
    await this.createSubscription()

    // Schedule auto-renewal
    setInterval(renewTask, renewalInterval)

    console.log('📧 Email webhook auto-renewal started (every 12 hours)')
  }
}

// Singleton instance
let emailWebhookServiceInstance = null

export function getEmailWebhookService() {
  if (!emailWebhookServiceInstance) {
    emailWebhookServiceInstance = new EmailWebhookService()
  }
  return emailWebhookServiceInstance
}

export default EmailWebhookService
