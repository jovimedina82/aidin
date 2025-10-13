#!/usr/bin/env node

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { initializeSocket } from './lib/socket.js'
import { getEmailWebhookService } from './lib/services/EmailWebhookService.js'

// Use NODE_ENV to determine dev mode
const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3011', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.IO if feature flag is enabled
  initializeSocket(server)

  // Initialize Email Webhook if enabled
  if (process.env.ENABLE_EMAIL_WEBHOOK === 'true' && process.env.NODE_ENV === 'production') {
    try {
      const emailWebhookService = getEmailWebhookService()
      await emailWebhookService.startAutoRenewal()
      console.log('> Email webhook: ENABLED')
    } catch (error) {
      console.error('Failed to start email webhook service:', error.message)
      console.log('> Email webhook: FAILED (will use polling only)')
    }
  } else {
    console.log('> Email webhook: DISABLED (using polling only)')
  }

  server.listen(port, hostname, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Environment: ${process.env.NODE_ENV}`)
    console.log(`> Live updates: ${process.env.ENABLE_LIVE_UPDATES === 'true' ? 'ENABLED' : 'DISABLED'}`)
  })
})
