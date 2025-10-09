import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import {
  ApiError,
  ApiSuccess,
  withErrorHandler,
  requireRoles
} from '@/lib/api-utils'
import { MicrosoftGraphService, getAppOnlyAccessToken } from '@/lib/services/MicrosoftGraphService'
import { prisma } from '@/lib/prisma'
import { logEvent } from '@/lib/audit'

export const POST = withErrorHandler(async (request) => {
  const user = await getCurrentUser(request)
  requireRoles(user, ['Admin'])

  // Check if Azure credentials are configured
  if (!process.env.AZURE_AD_CLIENT_ID || !process.env.AZURE_AD_CLIENT_SECRET || !process.env.AZURE_AD_TENANT_ID) {
    return ApiError.badRequest('Azure AD credentials not configured')
  }

  if (!process.env.MICROSOFT_GRAPH_SYNC_GROUP) {
    return ApiError.badRequest('Microsoft Graph sync group not configured')
  }

  try {
    console.log('Manual Azure AD sync initiated by:', user.email)

    // Get app-only access token
    const accessToken = await getAppOnlyAccessToken()
    const graphService = new MicrosoftGraphService(accessToken)

    const groupName = process.env.MICROSOFT_GRAPH_SYNC_GROUP

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
      return ApiError.internalServerError('Requester role not found in database')
    }

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

    // Create audit log using new audit system
    await logEvent({
      action: 'azure.sync.manual',
      actorId: user.id,
      actorEmail: user.email,
      actorType: 'human',
      entityType: 'user',
      entityId: 'bulk-sync',
      metadata: {
        groupName,
        totalUsers: users.length,
        created,
        updated,
        skipped,
        errors: errors.length,
        timestamp: new Date().toISOString(),
        automated: false,
        triggeredBy: user.email
      }
    })

    console.log(`Manual Azure AD sync completed: Created ${created}, Updated ${updated}, Skipped ${skipped}, Errors ${errors.length}`)

    return ApiSuccess.ok({
      success: true,
      summary: {
        totalUsers: users.length,
        created,
        updated,
        skipped,
        errors: errors.length
      },
      details: {
        groupName,
        timestamp: new Date(),
        triggeredBy: user.email,
        errorDetails: errors
      }
    })
  } catch (error) {
    console.error('Manual Azure sync error:', error)

    // Create error audit log using new audit system
    try {
      await logEvent({
        action: 'azure.sync.error',
        actorId: user.id,
        actorEmail: user.email,
        actorType: 'human',
        entityType: 'user',
        entityId: 'bulk-sync',
        metadata: {
          error: error.message,
          timestamp: new Date().toISOString(),
          triggeredBy: user.email
        }
      })
    } catch (logError) {
      console.error('Failed to create error audit log:', logError)
    }

    return ApiError.internalServerError(`Sync failed: ${error.message}`)
  }
})