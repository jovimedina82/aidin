import cron from 'node-cron'
import { PrismaClient } from '../generated/prisma/index.js'
import { MicrosoftGraphService, getAppOnlyAccessToken } from './MicrosoftGraphService.js'

const prisma = new PrismaClient()

class AzureSyncScheduler {
  constructor() {
    this.job = null
    this.isRunning = false
  }

  async syncUsers() {
    if (this.isRunning) {
      console.log('Azure sync already in progress, skipping...')
      return
    }

    this.isRunning = true
    console.log('Starting automatic Azure AD user sync...')

    try {
      const accessToken = await getAppOnlyAccessToken()
      const graphService = new MicrosoftGraphService(accessToken)
      
      const groupName = process.env.MICROSOFT_GRAPH_SYNC_GROUP
      if (!groupName) {
        console.error('MICROSOFT_GRAPH_SYNC_GROUP not configured')
        return
      }

      // Get users from the specified group
      const { group, users } = await graphService.getUsersFromGroupByName(groupName)
      
      let created = 0
      let updated = 0
      let skipped = 0
      let errors = []

      // Get the default "Requester" role
      const requesterRole = await prisma.role.findFirst({
        where: { name: 'Requester' }
      })

      if (!requesterRole) {
        console.error('Requester role not found in database')
        return
      }

      // Get system admin user for audit log
      const systemAdmin = await prisma.user.findFirst({
        where: {
          roles: {
            some: {
              role: {
                name: 'Admin'
              }
            }
          }
        }
      })

      for (const azureUser of users) {
        try {
          // Skip disabled accounts
          if (!azureUser.accountEnabled) {
            console.log(`Skipping disabled user: ${azureUser.userPrincipalName}`)
            skipped++
            continue
          }

          // Check if user already exists by Azure ID or email
          const existingUser = await prisma.user.findFirst({
            where: {
              OR: [
                { azureId: azureUser.id },
                { email: azureUser.mail || azureUser.userPrincipalName }
              ]
            },
            include: {
              roles: {
                include: {
                  role: true
                }
              }
            }
          })

          if (existingUser) {
            // User exists - update their information and sync photo
            let avatarPath = existingUser.avatar

            // Try to download and save user photo
            try {
              const downloadedAvatarPath = await graphService.downloadUserPhoto(
                azureUser.id,
                azureUser.userPrincipalName
              )
              if (downloadedAvatarPath) {
                avatarPath = downloadedAvatarPath
                console.log(`Downloaded photo for user: ${azureUser.userPrincipalName}`)
              }
            } catch (photoError) {
              console.warn(`Could not download photo for user ${azureUser.userPrincipalName}:`, photoError.message)
            }

            const updatedUser = await prisma.user.update({
              where: { id: existingUser.id },
              data: {
                firstName: azureUser.givenName || existingUser.firstName,
                lastName: azureUser.surname || existingUser.lastName,
                email: azureUser.mail || azureUser.userPrincipalName,
                azureId: azureUser.id,
                userPrincipalName: azureUser.userPrincipalName,
                jobTitle: azureUser.jobTitle,
                officeLocation: azureUser.officeLocation,
                mobilePhone: azureUser.mobilePhone,
                phone: azureUser.businessPhones?.[0],
                avatar: avatarPath,
                isActive: true,
                lastSyncAt: new Date()
              }
            })

            console.log(`Updated existing user: ${updatedUser.email}`)
            updated++
          } else {
            // Create new user with Requester role and download photo
            let avatarPath = null

            // Try to download and save user photo
            try {
              const downloadedAvatarPath = await graphService.downloadUserPhoto(
                azureUser.id,
                azureUser.userPrincipalName
              )
              if (downloadedAvatarPath) {
                avatarPath = downloadedAvatarPath
                console.log(`Downloaded photo for new user: ${azureUser.userPrincipalName}`)
              }
            } catch (photoError) {
              console.warn(`Could not download photo for new user ${azureUser.userPrincipalName}:`, photoError.message)
            }

            const newUser = await prisma.user.create({
              data: {
                firstName: azureUser.givenName || 'Unknown',
                lastName: azureUser.surname || 'User',
                email: azureUser.mail || azureUser.userPrincipalName,
                azureId: azureUser.id,
                userPrincipalName: azureUser.userPrincipalName,
                jobTitle: azureUser.jobTitle,
                officeLocation: azureUser.officeLocation,
                mobilePhone: azureUser.mobilePhone,
                phone: azureUser.businessPhones?.[0],
                avatar: avatarPath,
                password: null, // No password needed for Azure AD users
                isActive: true,
                lastSyncAt: new Date(),
                roles: {
                  create: {
                    roleId: requesterRole.id
                  }
                }
              }
            })

            console.log(`Created new user: ${newUser.email}`)
            created++
          }
        } catch (userError) {
          console.error(`Error syncing user ${azureUser.userPrincipalName}:`, userError)
          errors.push({
            user: azureUser.userPrincipalName,
            error: userError.message
          })
        }
      }

      // Create audit log
      if (systemAdmin) {
        await prisma.auditLog.create({
          data: {
            userId: systemAdmin.id,
            action: 'AZURE_SYNC_AUTO',
            entityType: 'User',
            entityId: 'bulk-sync',
            oldValues: null,
            newValues: JSON.stringify({
              groupName,
              totalUsers: users.length,
              created,
              updated,
              skipped,
              errors: errors.length,
              timestamp: new Date(),
              automated: true
            })
          }
        })
      }

      console.log(`Azure AD sync completed: Created ${created}, Updated ${updated}, Skipped ${skipped}, Errors ${errors.length}`)
      
      return {
        success: true,
        summary: { created, updated, skipped, errors: errors.length }
      }
    } catch (error) {
      console.error('Automatic Azure sync error:', error)
      return {
        success: false,
        error: error.message
      }
    } finally {
      this.isRunning = false
    }
  }

  start() {
    const syncInterval = parseInt(process.env.SYNC_INTERVAL_MINUTES || '30')
    const cronExpression = `*/${syncInterval} * * * *` // Every X minutes
    
    console.log(`Starting Azure AD sync scheduler: every ${syncInterval} minutes`)
    
    this.job = cron.schedule(cronExpression, async () => {
      await this.syncUsers()
    }, {
      scheduled: true,
      timezone: "UTC"
    })

    console.log('Azure AD sync scheduler started successfully')
  }

  stop() {
    if (this.job) {
      this.job.stop()
      this.job = null
      console.log('Azure AD sync scheduler stopped')
    }
  }

  // Manual trigger for testing
  async triggerSync() {
    return await this.syncUsers()
  }
}

// Create singleton instance
const azureSyncScheduler = new AzureSyncScheduler()

// Auto-start the scheduler when the module is loaded (only in production)
if (process.env.NODE_ENV === 'production') {
  azureSyncScheduler.start()
}

export default azureSyncScheduler