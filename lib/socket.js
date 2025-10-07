import { Server } from 'socket.io'
import { parse } from 'cookie'
import jwt from 'jsonwebtoken'

let io = null

export function initializeSocket(server) {
  // Only initialize if feature flag is enabled
  if (process.env.ENABLE_LIVE_UPDATES !== 'true') {
    console.log('📡 Live updates disabled (ENABLE_LIVE_UPDATES not set)')
    return null
  }

  if (io) {
    console.log('📡 Socket.IO already initialized')
    return io
  }

  io = new Server(server, {
    path: '/api/socket',
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || '*',
      credentials: true
    }
  })

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const cookies = parse(socket.handshake.headers.cookie || '')
      const token = cookies.token

      if (!token) {
        return next(new Error('Authentication required'))
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      if (!decoded || !decoded.userId) {
        return next(new Error('Invalid token'))
      }

      // Attach user info to socket
      socket.userId = decoded.userId
      socket.userEmail = decoded.email
      socket.userRoles = decoded.roles || []

      next()
    } catch (error) {
      console.error('Socket authentication error:', error)
      next(new Error('Authentication failed'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`✅ User connected: ${socket.userEmail} (${socket.id})`)

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.userEmail} (${socket.id})`)
    })
  })

  console.log('📡 Socket.IO server initialized with authentication')
  return io
}

export function getIO() {
  if (!io) {
    // Silently return null instead of logging warnings
    return null
  }
  return io
}

// Emit ticket events
export function emitTicketCreated(ticket) {
  const socketIO = getIO()
  if (!socketIO) {
    // Socket.IO not enabled, skip silently
    return
  }

  socketIO.emit('ticket:created', {
    ticket,
    timestamp: new Date().toISOString()
  })
}

export function emitTicketUpdated(ticket) {
  const socketIO = getIO()
  if (!socketIO) {
    // Socket.IO not enabled, skip silently
    return
  }

  socketIO.emit('ticket:updated', {
    ticket,
    timestamp: new Date().toISOString()
  })
}

export function emitTicketDeleted(ticketId) {
  const socketIO = getIO()
  if (!socketIO) {
    // Socket.IO not enabled, skip silently
    return
  }

  socketIO.emit('ticket:deleted', {
    ticketId,
    timestamp: new Date().toISOString()
  })
}

export function emitStatsUpdate(stats) {
  const socketIO = getIO()
  if (!socketIO) {
    // Socket.IO not enabled, skip silently
    return
  }

  socketIO.emit('stats:updated', {
    stats,
    timestamp: new Date().toISOString()
  })
}
