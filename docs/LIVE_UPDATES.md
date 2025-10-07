# Live Updates (WebSocket) Feature

## Overview

The helpdesk dashboard supports **real-time live updates** using WebSocket (Socket.IO) technology. When enabled, the dashboard automatically updates ticket counts and recent tickets whenever changes occur, without requiring page refreshes or polling.

## Feature Flag System

Live updates are controlled by feature flags and are **disabled by default**. This ensures the system works exactly as before unless explicitly enabled.

### Server-Side Flag
```bash
ENABLE_LIVE_UPDATES=true
```
Controls whether the Socket.IO server is initialized.

### Client-Side Flag
```bash
NEXT_PUBLIC_ENABLE_LIVE_UPDATES=true
```
Controls whether the dashboard client connects to WebSocket.

## How to Enable

1. Open `/opt/apps/aidin/.env`
2. Change both flags to `true`:
```env
ENABLE_LIVE_UPDATES=true
NEXT_PUBLIC_ENABLE_LIVE_UPDATES=true
```
3. Rebuild the application:
```bash
npm run build
```
4. Restart PM2:
```bash
npx pm2 restart aidin-helpdesk
```

## How It Works

### When ENABLED (WebSocket Mode)
1. Dashboard connects to Socket.IO server on page load
2. Server emits events when tickets are created/updated/deleted
3. Dashboard receives events and refreshes data instantly
4. **No polling** - updates happen in real-time

### When DISABLED (Polling Mode)
1. Dashboard falls back to polling every 30 seconds
2. Works exactly as it did before this feature
3. No WebSocket connection attempted

### Fallback Behavior
Even when enabled, if WebSocket connection fails:
- Dashboard automatically falls back to polling
- No errors shown to user
- System continues working normally

## Events Emitted

| Event | Description | Payload |
|-------|-------------|---------|
| `ticket:created` | New ticket created | `{ ticket, timestamp }` |
| `ticket:updated` | Ticket status/assignment changed | `{ ticket, timestamp }` |
| `ticket:deleted` | Ticket deleted | `{ ticketId, timestamp }` |
| `stats:updated` | Dashboard statistics changed | `{ stats, timestamp }` |

## Authentication

WebSocket connections are authenticated using the same JWT token from cookies. Only authenticated users can connect.

## Monitoring

Check if live updates are working:

```bash
# View server logs
npx pm2 logs aidin-helpdesk --lines 50

# Look for these messages:
📡 Socket.IO server initialized with authentication
✅ User connected: user@example.com (socket-id)
```

## Testing

1. **Enable live updates** (see above)
2. Open dashboard in two browser windows
3. Create/update a ticket in one window
4. Observe the other window update automatically

## Troubleshooting

### Live updates not working?

1. Check feature flags are set to `true` in `.env`
2. Rebuild and restart after changing flags
3. Check browser console for connection errors
4. Verify JWT token is valid (check cookies)
5. Check server logs for Socket.IO errors

### Dashboard still polling?

- Live updates are intentionally disabled by default
- Check `.env` file has both flags set to `true`
- Rebuild application after changing flags
- Hard refresh browser (Ctrl+Shift+R)

## Performance

- **With WebSockets**: ~0.1KB per update event
- **With Polling**: ~5-10KB every 30 seconds
- WebSockets use significantly less bandwidth and provide instant updates

## Architecture

```
┌─────────────┐                  ┌─────────────┐
│  Dashboard  │ ◄─── Socket ───► │   Server    │
│  (Client)   │                  │  (Custom)   │
└─────────────┘                  └─────────────┘
                                       │
                                       ▼
                                 ┌─────────────┐
                                 │ Ticket APIs │
                                 │  (Emit      │
                                 │   Events)   │
                                 └─────────────┘
```

## Files Modified

- `lib/socket.js` - Socket.IO server setup
- `server.js` - Custom Next.js server with Socket.IO
- `lib/hooks/useSocket.js` - React hook for WebSocket
- `app/dashboard/page.js` - Dashboard with live updates
- `app/api/tickets/route.js` - Emit events on ticket create
- `app/api/tickets/[id]/route.js` - Emit events on update/delete
- `package.json` - Updated start script

## Safety

- **No breaking changes** - Feature is off by default
- **Graceful degradation** - Falls back to polling if WebSocket fails
- **Backward compatible** - Works with existing REST endpoints
- **Secure** - Uses same authentication as REST APIs
