import 'dotenv/config'
import { prisma } from '../lib/prisma.js'

type GraphUser = {
  id?: string
  displayName?: string
  mail?: string
  userPrincipalName?: string
  givenName?: string
  surname?: string
}

function hasAzureCreds() {
  return Boolean(
    process.env.AZURE_TENANT_ID &&
    process.env.AZURE_CLIENT_ID &&
    process.env.AZURE_CLIENT_SECRET
  )
}

async function getGraphToken() {
  const tenantId = process.env.AZURE_TENANT_ID
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  const params = new URLSearchParams()
  params.set('client_id', process.env.AZURE_CLIENT_ID!)
  params.set('client_secret', process.env.AZURE_CLIENT_SECRET!)
  params.set('grant_type', 'client_credentials')
  params.set('scope', process.env.GRAPH_SCOPE || 'https://graph.microsoft.com/.default')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph token failed: ${res.status} ${text}`)
  }
  const json: any = await res.json()
  return json.access_token as string
}

async function getGraphUserByEmail(token: string, email: string): Promise<GraphUser | null> {
  const base = process.env.GRAPH_API_BASE || 'https://graph.microsoft.com/v1.0'
  const url = `${base}/users/${encodeURIComponent(email)}?$select=id,displayName,mail,userPrincipalName,givenName,surname`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph lookup failed: ${res.status} ${text}`)
  }
  return (await res.json()) as GraphUser
}

async function upsertAdminUser(email: string, graphUser?: GraphUser | null) {
  // Extract name from Graph data or use email
  const firstName = graphUser?.givenName || email.split('@')[0]
  const lastName = graphUser?.surname || ''
  const azureId = graphUser?.id
  const userPrincipalName = graphUser?.userPrincipalName

  // Ensure ADMIN role exists
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrator with full system access',
      permissions: JSON.stringify({
        tickets: ['create', 'read', 'update', 'delete'],
        users: ['create', 'read', 'update', 'delete'],
        settings: ['read', 'update']
      })
    }
  })

  // Upsert the user
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName,
      lastName,
      azureId: azureId || undefined,
      userPrincipalName: userPrincipalName || undefined,
      isActive: true,
      lastSyncAt: new Date()
    },
    create: {
      email,
      firstName,
      lastName,
      azureId: azureId || undefined,
      userPrincipalName: userPrincipalName || undefined,
      isActive: true,
      userType: 'Staff',
      lastSyncAt: new Date()
    }
  })

  // Ensure user has ADMIN role
  const existingRole = await prisma.userRole.findFirst({
    where: {
      userId: user.id,
      roleId: adminRole.id
    }
  })

  if (!existingRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id
      }
    })
    console.log(`✓ Assigned ADMIN role to ${email}`)
  } else {
    console.log(`✓ User ${email} already has ADMIN role`)
  }

  return user
}

async function main() {
  const email = process.argv[2] || 'jmedina@surterreproperties.com'
  console.log(`\n▶ Syncing or seeding admin user: ${email}\n`)

  let graphUser: GraphUser | null = null

  if (hasAzureCreds()) {
    try {
      console.log('🔐 Attempting to fetch user from Microsoft Graph...')
      const token = await getGraphToken()
      graphUser = await getGraphUserByEmail(token, email)
      if (graphUser) {
        const displayName = graphUser.displayName || [graphUser.givenName, graphUser.surname].filter(Boolean).join(' ') || graphUser.userPrincipalName || graphUser.mail || email
        console.log(`✓ Fetched from Graph: ${displayName}`)
        console.log(`  Azure ID: ${graphUser.id}`)
        console.log(`  UPN: ${graphUser.userPrincipalName}`)
      } else {
        console.warn('⚠ User not found in Graph. Proceeding with local seed.')
      }
    } catch (err) {
      console.warn('⚠ Graph sync failed, proceeding with local seed.')
      console.error('  Error:', err instanceof Error ? err.message : err)
    }
  } else {
    console.warn('⚠ Azure creds incomplete in .env.local — proceeding with local seed.')
    console.log('  Missing: ' + [
      !process.env.AZURE_TENANT_ID && 'AZURE_TENANT_ID',
      !process.env.AZURE_CLIENT_ID && 'AZURE_CLIENT_ID',
      !process.env.AZURE_CLIENT_SECRET && 'AZURE_CLIENT_SECRET'
    ].filter(Boolean).join(', '))
  }

  const user = await upsertAdminUser(email, graphUser)

  console.log('\n✅ Admin user ready!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`Email: ${user.email}`)
  console.log(`Name: ${user.firstName} ${user.lastName}`)
  console.log(`Azure ID: ${user.azureId || 'N/A (local only)'}`)
  console.log(`Active: ${user.isActive}`)
  console.log('Role: ADMIN')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('\n✓ You can now log in at http://localhost:3000/login\n')

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('\n❌ Error:', e)
  process.exit(1)
})
