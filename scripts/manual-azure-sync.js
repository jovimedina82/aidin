#!/usr/bin/env node

/**
 * Manual Azure AD Sync Script
 * Syncs users from Azure AD IT-Helpdesk group to local database
 * Run this when you need to bootstrap the system or manually sync users
 */

import { PrismaClient } from '../lib/generated/prisma/index.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function getAppOnlyAccessToken() {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', process.env.AZURE_AD_CLIENT_ID);
  params.append('client_secret', process.env.AZURE_AD_CLIENT_SECRET);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('grant_type', 'client_credentials');

  const response = await axios.post(tokenUrl, params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  return response.data.access_token;
}

async function getGroupByName(accessToken, groupName) {
  const response = await axios.get(
    `https://graph.microsoft.com/v1.0/groups`,
    {
      params: {
        $filter: `displayName eq '${groupName}'`,
        $select: 'id,displayName'
      },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  if (!response.data.value || response.data.value.length === 0) {
    throw new Error(`Group '${groupName}' not found`);
  }

  return response.data.value[0];
}

async function getUsersFromGroup(accessToken, groupId) {
  const response = await axios.get(
    `https://graph.microsoft.com/v1.0/groups/${groupId}/members`,
    {
      params: {
        $select: 'id,userPrincipalName,mail,givenName,surname,displayName,jobTitle,officeLocation,mobilePhone,businessPhones,accountEnabled'
      },
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  return response.data.value;
}

async function downloadUserPhoto(accessToken, userId, userPrincipalName) {
  try {
    const response = await axios.get(
      `https://graph.microsoft.com/v1.0/users/${userId}/photo/$value`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        },
        responseType: 'arraybuffer'
      }
    );

    // Save photo to public/avatars directory
    const avatarsDir = path.join(process.cwd(), 'public', 'avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }

    const fileName = `${userPrincipalName.replace(/[^a-z0-9]/gi, '_')}.jpg`;
    const filePath = path.join(avatarsDir, fileName);

    fs.writeFileSync(filePath, response.data);

    return `/avatars/${fileName}`;
  } catch (error) {
    // Photo might not exist
    return null;
  }
}

async function syncUsers() {
  console.log('🔄 Starting Azure AD sync...\n');

  // Check environment variables
  if (!process.env.AZURE_AD_CLIENT_ID || !process.env.AZURE_AD_CLIENT_SECRET || !process.env.AZURE_AD_TENANT_ID) {
    console.error('❌ Azure AD credentials not configured');
    process.exit(1);
  }

  if (!process.env.MICROSOFT_GRAPH_SYNC_GROUP) {
    console.error('❌ Microsoft Graph sync group not configured');
    process.exit(1);
  }

  try {
    // Get access token
    console.log('🔑 Getting access token...');
    const accessToken = await getAppOnlyAccessToken();
    console.log('✅ Access token obtained\n');

    // Get group
    const groupName = process.env.MICROSOFT_GRAPH_SYNC_GROUP;
    console.log(`📁 Looking up group: ${groupName}...`);
    const group = await getGroupByName(accessToken, groupName);
    console.log(`✅ Group found: ${group.displayName} (${group.id})\n`);

    // Get users from group
    console.log('👥 Fetching users from group...');
    const users = await getUsersFromGroup(accessToken, group.id);
    console.log(`✅ Found ${users.length} users\n`);

    // Get or create Requester role
    let requesterRole = await prisma.role.findFirst({
      where: { name: 'Requester' }
    });

    if (!requesterRole) {
      console.log('📝 Creating Requester role...');
      requesterRole = await prisma.role.create({
        data: {
          name: 'Requester',
          description: 'Can create and view their own tickets',
          permissions: {}
        }
      });
      console.log('✅ Requester role created\n');
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = [];

    console.log('🔄 Processing users...\n');

    for (const azureUser of users) {
      try {
        // Skip disabled accounts
        if (!azureUser.accountEnabled) {
          console.log(`⏭️  Skipping disabled user: ${azureUser.userPrincipalName}`);
          skipped++;
          continue;
        }

        const email = azureUser.mail || azureUser.userPrincipalName;

        // Check if user exists
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { azureId: azureUser.id },
              { email: email }
            ]
          }
        });

        // Download photo
        let avatarPath = null;
        try {
          avatarPath = await downloadUserPhoto(accessToken, azureUser.id, azureUser.userPrincipalName);
          if (avatarPath) {
            console.log(`   📸 Downloaded photo for ${email}`);
          }
        } catch (photoError) {
          // Photo download is optional
        }

        if (existingUser) {
          // Update existing user
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              firstName: azureUser.givenName || existingUser.firstName,
              lastName: azureUser.surname || existingUser.lastName,
              email: email,
              azureId: azureUser.id,
              userPrincipalName: azureUser.userPrincipalName,
              jobTitle: azureUser.jobTitle,
              officeLocation: azureUser.officeLocation,
              mobilePhone: azureUser.mobilePhone,
              phone: azureUser.businessPhones?.[0],
              avatar: avatarPath || existingUser.avatar,
              isActive: true,
              lastSyncAt: new Date()
            }
          });

          console.log(`✏️  Updated: ${email}`);
          updated++;
        } else {
          // Create new user
          const newUser = await prisma.user.create({
            data: {
              firstName: azureUser.givenName || 'Unknown',
              lastName: azureUser.surname || 'User',
              email: email,
              azureId: azureUser.id,
              userPrincipalName: azureUser.userPrincipalName,
              jobTitle: azureUser.jobTitle,
              officeLocation: azureUser.officeLocation,
              mobilePhone: azureUser.mobilePhone,
              phone: azureUser.businessPhones?.[0],
              avatar: avatarPath,
              password: null, // No password for Azure AD users
              isActive: true,
              lastSyncAt: new Date(),
              roles: {
                create: {
                  roleId: requesterRole.id
                }
              }
            }
          });

          console.log(`➕ Created: ${email}`);
          created++;
        }
      } catch (userError) {
        console.error(`❌ Error processing ${azureUser.userPrincipalName}:`, userError.message);
        errors.push({
          user: azureUser.userPrincipalName,
          error: userError.message
        });
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('📊 Sync Summary');
    console.log('='.repeat(50));
    console.log(`Total users in group: ${users.length}`);
    console.log(`✅ Created: ${created}`);
    console.log(`✏️  Updated: ${updated}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Errors: ${errors.length}`);
    console.log('='.repeat(50) + '\n');

    if (errors.length > 0) {
      console.log('Error details:');
      errors.forEach(e => {
        console.log(`  - ${e.user}: ${e.error}`);
      });
    }

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncUsers().catch(console.error);
