/**
 * User Email Management Utilities
 *
 * Handles multi-email functionality for users:
 * - Links external emails (Gmail, Yahoo, etc.) to @surterreproperties.com users
 * - Finds users by any of their email addresses
 * - Manages email addresses for notifications
 */

import { prisma } from './prisma.js'

/**
 * Find a user by any of their email addresses (primary or alternate)
 * @param {string} email - Email address to search for
 * @returns {Promise<User|null>} User object with all emails, or null if not found
 */
export async function findUserByAnyEmail(email) {
  if (!email) return null

  const normalizedEmail = email.toLowerCase().trim()

  // First, check if it's a primary email
  let user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    include: {
      alternateEmails: true,
      roles: {
        include: {
          role: true
        }
      }
    }
  })

  if (user) return user

  // If not found, check if it's an alternate email
  const userEmail = await prisma.userEmail.findUnique({
    where: { email: normalizedEmail },
    include: {
      user: {
        include: {
          alternateEmails: true,
          roles: {
            include: {
              role: true
            }
          }
        }
      }
    }
  })

  return userEmail?.user || null
}

/**
 * Get all email addresses for a user (primary + alternates)
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} Array of email addresses
 */
export async function getAllUserEmails(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      alternateEmails: {
        where: { isVerified: true } // Only include verified emails for notifications
      }
    }
  })

  if (!user) return []

  const emails = [user.email] // Primary email

  // Add all verified alternate emails
  if (user.alternateEmails) {
    emails.push(...user.alternateEmails.map(e => e.email))
  }

  return emails
}

/**
 * Link an external email to a user (if user exists with @surterreproperties.com)
 *
 * This function is called when:
 * 1. A ticket is created from an external email (Gmail, Yahoo, etc.)
 * 2. We want to check if this external email belongs to an existing employee
 *
 * Logic:
 * - Extract the name part from the external email (e.g., "john.doe" from "john.doe@gmail.com")
 * - Look for a user with a similar @surterreproperties.com email
 * - If found, link the external email to that user
 *
 * @param {string} externalEmail - External email address (Gmail, Yahoo, etc.)
 * @param {string} addedBy - User ID who is linking this email (system or admin)
 * @returns {Promise<{user: User|null, linked: boolean, newEmail: boolean}>}
 */
export async function linkExternalEmailToUser(externalEmail, addedBy = 'system') {
  if (!externalEmail) {
    return { user: null, linked: false, newEmail: false }
  }

  const normalizedEmail = externalEmail.toLowerCase().trim()

  // Check if email already exists (primary or alternate)
  const existingUser = await findUserByAnyEmail(normalizedEmail)
  if (existingUser) {
    return { user: existingUser, linked: true, newEmail: false }
  }

  // Extract username part from email (before @)
  const [username] = normalizedEmail.split('@')
  if (!username) {
    return { user: null, linked: false, newEmail: false }
  }

  // Look for a user with @surterreproperties.com that matches the username
  // For example: "john.doe@gmail.com" -> find "john.doe@surterreproperties.com"
  const surterreEmail = `${username}@surterreproperties.com`

  const surterreUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: surterreEmail },
        { email: { startsWith: username + '@', mode: 'insensitive' } },
        {
          alternateEmails: {
            some: {
              email: { contains: username, mode: 'insensitive' }
            }
          }
        }
      ]
    },
    include: {
      alternateEmails: true,
      roles: {
        include: {
          role: true
        }
      }
    }
  })

  if (!surterreUser) {
    // No matching Surterre user found
    return { user: null, linked: false, newEmail: false }
  }

  // Link the external email to the Surterre user
  try {
    await prisma.userEmail.create({
      data: {
        userId: surterreUser.id,
        email: normalizedEmail,
        emailType: 'personal',
        isPrimary: false,
        isVerified: true, // Auto-verify since it came from a real email
        addedBy: addedBy,
        verifiedAt: new Date()
      }
    })

    console.log(`✅ Linked external email ${normalizedEmail} to user ${surterreUser.email}`)

    // Refresh user data with new email
    const updatedUser = await prisma.user.findUnique({
      where: { id: surterreUser.id },
      include: {
        alternateEmails: true,
        roles: {
          include: {
            role: true
          }
        }
      }
    })

    return { user: updatedUser, linked: true, newEmail: true }
  } catch (error) {
    console.error('Error linking external email:', error)
    // Return the user even if linking failed (email might already be linked)
    return { user: surterreUser, linked: true, newEmail: false }
  }
}

/**
 * Add an alternate email to a user manually (from UI)
 * @param {string} userId - User ID
 * @param {string} email - Email address to add
 * @param {string} emailType - Type of email (personal, work, alternate)
 * @param {string} addedBy - User ID who is adding this email
 * @returns {Promise<UserEmail>}
 */
export async function addAlternateEmail(userId, email, emailType = 'alternate', addedBy) {
  const normalizedEmail = email.toLowerCase().trim()

  // Check if email is already in use
  const existingUser = await findUserByAnyEmail(normalizedEmail)
  if (existingUser && existingUser.id !== userId) {
    throw new Error('This email is already associated with another user')
  }

  if (existingUser && existingUser.id === userId) {
    throw new Error('This email is already associated with this user')
  }

  // Create the alternate email
  const userEmail = await prisma.userEmail.create({
    data: {
      userId,
      email: normalizedEmail,
      emailType,
      isPrimary: false,
      isVerified: false, // Require verification for manually added emails
      addedBy
    }
  })

  return userEmail
}

/**
 * Remove an alternate email from a user
 * @param {string} userEmailId - UserEmail ID to remove
 * @param {string} userId - User ID (for verification)
 * @returns {Promise<void>}
 */
export async function removeAlternateEmail(userEmailId, userId) {
  // Verify the email belongs to the user
  const userEmail = await prisma.userEmail.findUnique({
    where: { id: userEmailId }
  })

  if (!userEmail) {
    throw new Error('Email not found')
  }

  if (userEmail.userId !== userId) {
    throw new Error('You do not have permission to remove this email')
  }

  if (userEmail.isPrimary) {
    throw new Error('Cannot remove primary email. Update the primary email first.')
  }

  await prisma.userEmail.delete({
    where: { id: userEmailId }
  })
}

/**
 * Verify an alternate email
 * @param {string} userEmailId - UserEmail ID to verify
 * @returns {Promise<UserEmail>}
 */
export async function verifyAlternateEmail(userEmailId) {
  const userEmail = await prisma.userEmail.update({
    where: { id: userEmailId },
    data: {
      isVerified: true,
      verifiedAt: new Date()
    }
  })

  return userEmail
}

/**
 * Get all alternate emails for a user
 * @param {string} userId - User ID
 * @returns {Promise<UserEmail[]>}
 */
export async function getUserAlternateEmails(userId) {
  const alternateEmails = await prisma.userEmail.findMany({
    where: { userId },
    orderBy: { addedAt: 'desc' }
  })

  return alternateEmails
}
