# API Token Testing Guide

## Overview

The `/api/auth/mint-token` endpoint allows admins to generate short-lived JWT tokens for API testing without needing to extract session cookies from browser DevTools.

## Prerequisites

- Admin or Manager role
- Active browser session (logged in)

## Usage

### Method 1: Using Browser Session Cookie

**Step 1: Login via browser**
```bash
# Navigate to https://your-domain.com/login
# Login with admin credentials
```

**Step 2: Export cookies (Chrome/Firefox)**
```bash
# Install a cookie export extension like "Cookie-Editor" or "EditThisCookie"
# Export cookies to cookies.txt in Netscape format
```

**Step 3: Mint token**
```bash
curl -s -X POST \
  -b cookies.txt \
  https://your-domain.com/api/auth/mint-token | jq -r .token
```

**Step 4: Save token to variable**
```bash
TOKEN=$(curl -s -X POST -b cookies.txt https://your-domain.com/api/auth/mint-token | jq -r .token)
echo $TOKEN
```

**Step 5: Use token in API requests**
```bash
# Example: Test presence API
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/presence/options | jq
```

### Method 2: Direct Browser Request (Simple)

**Step 1: Login to app via browser**

**Step 2: Open browser console (F12) and run:**
```javascript
fetch('/api/auth/mint-token', {
  method: 'POST',
  credentials: 'include'
})
  .then(r => r.json())
  .then(data => {
    console.log('Token:', data.token)
    navigator.clipboard.writeText(data.token)
    alert('Token copied to clipboard!')
  })
```

**Step 3: Token is now in your clipboard - use it:**
```bash
# Paste token into this command:
curl -H "Authorization: Bearer <PASTE_TOKEN_HERE>" \
  https://your-domain.com/api/presence/day?date=2025-01-20
```

### Method 3: Using Session from Dev Server

If running locally:

```bash
# 1. Login via browser to http://localhost:3011
# 2. Get cookies from browser DevTools
# 3. Create cookies.txt:
echo "localhost FALSE / FALSE 0 token YOUR_SESSION_TOKEN" > cookies.txt

# 4. Mint token
TOKEN=$(curl -s -X POST -b cookies.txt http://localhost:3011/api/auth/mint-token | jq -r .token)

# 5. Test APIs
curl -H "Authorization: Bearer $TOKEN" http://localhost:3011/api/presence/options | jq
```

## Token Details

- **Lifetime**: 30 minutes (short-lived for security)
- **Issuer**: "aidin"
- **Payload**:
  ```json
  {
    "userId": "uuid",
    "email": "admin@example.com",
    "firstName": "Admin",
    "lastName": "User",
    "roles": ["Admin"],
    "iat": 1234567890,
    "exp": 1234569690,
    "iss": "aidin"
  }
  ```

## Response Format

**Success (200)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "30m",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "name": "Admin User",
    "roles": ["Admin"]
  }
}
```

**Unauthorized (401)** - No active session:
```json
{
  "error": "Unauthorized - no active session"
}
```

**Forbidden (403)** - Not an admin:
```json
{
  "error": "Forbidden - admin access required"
}
```

## Common API Testing Scenarios

### 1. Test Presence Options API
```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/presence/options | jq
```

### 2. Create Schedule
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-20",
    "segments": [
      {
        "statusCode": "WORKING_REMOTE",
        "from": "09:00",
        "to": "17:00"
      }
    ]
  }' \
  https://your-domain.com/api/presence/plan-day | jq
```

### 3. Get Day Schedule
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/presence/day?date=2025-01-20" | jq
```

### 4. Delete Segment
```bash
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  https://your-domain.com/api/presence/segment/<SEGMENT_ID> | jq
```

### 5. Admin: Create Status
```bash
curl -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "MATERNITY_LEAVE",
    "label": "Maternity Leave",
    "category": "time_off",
    "requiresOffice": false,
    "color": "#ec4899",
    "icon": "Baby",
    "isActive": true
  }' \
  https://your-domain.com/api/presence/admin/status | jq
```

## Security Notes

- ⚠️ **Admin-only**: Only users with Admin or Manager roles can mint tokens
- ⚠️ **Short-lived**: Tokens expire after 30 minutes
- ⚠️ **Audit logged**: Every token mint is logged in audit trail
- ⚠️ **Production use**: This endpoint is intended for testing, not production automation
- ⚠️ **Session required**: Must have active browser session first

## Troubleshooting

### "Unauthorized - no active session"
**Solution**: Login via browser first, ensure cookies are being sent

### "Forbidden - admin access required"
**Solution**: Check your user has Admin or Manager role:
```sql
SELECT u.email, r.name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.email = 'your-email@example.com';
```

### "Server misconfiguration"
**Solution**: Check `JWT_SECRET` environment variable is set:
```bash
echo $JWT_SECRET
# Should output a secret key, not empty
```

### Token expired
**Solution**: Mint a new token (tokens last 30 minutes)

## Alternative: Using Regular Login

If you prefer not to use this endpoint, you can still test APIs using the standard login flow:

```bash
# 1. Login and get token
TOKEN=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"your-password"}' \
  https://your-domain.com/api/auth/login | jq -r .token)

# 2. Use token
curl -H "Authorization: Bearer $TOKEN" https://your-domain.com/api/presence/options | jq
```

## Audit Trail

Every token mint creates an audit log entry:

```json
{
  "action": "auth.mint_token.success",
  "actorId": "user-uuid",
  "actorEmail": "admin@example.com",
  "actorType": "human",
  "entityType": "auth",
  "metadata": {
    "expiresIn": "30m",
    "purpose": "api_testing",
    "ip": "1.2.3.4"
  }
}
```

View audit logs:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "https://your-domain.com/api/admin/audit?action=auth.mint_token.success" | jq
```
