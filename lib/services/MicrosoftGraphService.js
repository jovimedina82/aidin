import axios from 'axios'
import fs from 'fs'
import path from 'path'

export class MicrosoftGraphService {
  constructor(accessToken) {
    this.client = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })
  }

  // Get current user profile
  async getCurrentUser() {
    try {
      const response = await this.client.get('/me')
      return response.data
    } catch (error) {
      console.error('Error fetching current user:', error)
      throw error
    }
  }

  // Get current user's groups
  async getCurrentUserGroups() {
    try {
      const response = await this.client.get('/me/memberOf')
      // Filter to only include security groups and mail-enabled security groups
      return response.data.value.filter(
        group => group['@odata.type'] === '#microsoft.graph.group'
      )
    } catch (error) {
      console.error('Error fetching user groups:', error)
      throw error
    }
  }

  // Get all users from a specific group by name
  async getUsersFromGroupByName(groupName) {
    try {
      // First, find the group by name
      const groupsResponse = await this.client.get(`/groups?$filter=displayName eq '${groupName}'`)
      const groups = groupsResponse.data.value
      
      if (groups.length === 0) {
        throw new Error(`Group '${groupName}' not found`)
      }

      const group = groups[0]
      
      // Get all members of the group with required user properties
      const users = new Map()
      let nextLink = `/groups/${group.id}/members?$select=id,displayName,givenName,surname,userPrincipalName,mail,jobTitle,officeLocation,businessPhones,mobilePhone,accountEnabled`
      
      // Handle pagination
      while (nextLink) {
        const response = await this.client.get(nextLink)
        
        // Filter for user objects only and process them
        const groupUsers = response.data.value.filter(
          member => member['@odata.type'] === '#microsoft.graph.user' || !member['@odata.type']
        )
        
        // Add users to map (to avoid duplicates)
        for (const user of groupUsers) {
          if (!users.has(user.id)) {
            users.set(user.id, {
              id: user.id,
              displayName: user.displayName,
              givenName: user.givenName,
              surname: user.surname,
              userPrincipalName: user.userPrincipalName,
              mail: user.mail,
              jobTitle: user.jobTitle,
              officeLocation: user.officeLocation,
              businessPhones: user.businessPhones,
              mobilePhone: user.mobilePhone,
              accountEnabled: user.accountEnabled !== undefined ? user.accountEnabled : true // Default to true if undefined
            })
          }
        }
        
        // Check if there are more pages
        nextLink = response.data['@odata.nextLink'] 
          ? response.data['@odata.nextLink'].replace('https://graph.microsoft.com/v1.0', '')
          : null
      }
      
      return {
        group: {
          id: group.id,
          displayName: group.displayName,
          description: group.description
        },
        users: Array.from(users.values())
      }
    } catch (error) {
      console.error(`Error fetching users from group '${groupName}':`, error)
      throw error
    }
  }

  // Get specific group by ID
  async getGroup(groupId) {
    try {
      const response = await this.client.get(`/groups/${groupId}`)
      return response.data
    } catch (error) {
      console.error(`Error fetching group ${groupId}:`, error)
      throw error
    }
  }

  // Get groups by name filter
  async getGroupsByName(nameFilter) {
    try {
      const response = await this.client.get(`/groups?$filter=startswith(displayName,'${nameFilter}')`)
      return response.data.value
    } catch (error) {
      console.error(`Error fetching groups with filter ${nameFilter}:`, error)
      throw error
    }
  }

  // Get user photo from Microsoft Graph
  async getUserPhoto(userId) {
    try {
      const response = await this.client.get(`/users/${userId}/photo/$value`, {
        responseType: 'arraybuffer'
      })
      return response.data
    } catch (error) {
      if (error.response?.status === 404) {
        // No photo found for user
        return null
      }
      console.error(`Error fetching photo for user ${userId}:`, error)
      throw error
    }
  }

  // Get photo metadata to check if user has a photo
  async getUserPhotoMetadata(userId) {
    try {
      const response = await this.client.get(`/users/${userId}/photo`)
      return response.data
    } catch (error) {
      if (error.response?.status === 404) {
        return null
      }
      console.error(`Error fetching photo metadata for user ${userId}:`, error)
      throw error
    }
  }

  // Download and save user photo to local filesystem
  async downloadUserPhoto(userId, userPrincipalName, publicDir = './public') {
    try {
      // Get photo metadata first to check if photo exists
      const metadata = await this.getUserPhotoMetadata(userId)
      if (!metadata) {
        return null
      }

      // Download the photo
      const photoBuffer = await this.getUserPhoto(userId)
      if (!photoBuffer) {
        return null
      }

      // Create avatars directory if it doesn't exist
      const avatarsDir = path.join(publicDir, 'avatars')
      if (!fs.existsSync(avatarsDir)) {
        fs.mkdirSync(avatarsDir, { recursive: true })
      }

      // Generate filename based on user principal name or ID
      const sanitizedName = (userPrincipalName || userId).replace(/[^a-zA-Z0-9]/g, '_')
      const filename = `${sanitizedName}.jpg`
      const filePath = path.join(avatarsDir, filename)

      // Save the photo
      fs.writeFileSync(filePath, photoBuffer)

      // Return the API path for serving the image
      return `/api/avatars/${filename}`
    } catch (error) {
      console.error(`Error downloading photo for user ${userId}:`, error)
      return null
    }
  }

  // Test connection and permissions
  async testConnection() {
    try {
      // Test basic access first
      console.log('Testing Microsoft Graph API access...')
      
      // Test organization access (requires Directory.Read.All)
      try {
        await this.client.get('/organization')
        console.log('✅ Organization access successful')
      } catch (orgError) {
        console.log('❌ Organization access failed:', orgError.response?.data)
        if (orgError.response?.data?.error?.code === 'Authorization_RequestDenied') {
          return {
            success: false,
            message: 'Missing API permissions. Please add Directory.Read.All, Group.Read.All, and User.Read.All permissions to your Azure AD app registration.',
            error: 'MISSING_PERMISSIONS',
            details: {
              required_permissions: [
                'Directory.Read.All',
                'Group.Read.All', 
                'User.Read.All'
              ],
              instructions: [
                '1. Go to Azure Portal → App registrations',
                '2. Select your app registration',
                '3. Go to API permissions',
                '4. Add Microsoft Graph permissions:',
                '   - Directory.Read.All (Application)',
                '   - Group.Read.All (Application)', 
                '   - User.Read.All (Application)',
                '5. Click "Grant admin consent"'
              ]
            }
          }
        }
      }
      
      // Test group access
      const testGroupName = process.env.MICROSOFT_GRAPH_SYNC_GROUP
      if (testGroupName) {
        try {
          await this.getUsersFromGroupByName(testGroupName)
          console.log('✅ Group access successful')
        } catch (groupError) {
          console.log('❌ Group access failed:', groupError.response?.data)
          if (groupError.response?.data?.error?.code === 'Authorization_RequestDenied') {
            return {
              success: false,
              message: 'Missing group permissions. Please add Group.Read.All permission to your Azure AD app registration.',
              error: 'MISSING_GROUP_PERMISSIONS'
            }
          }
          
          // If group not found, list available groups
          if (groupError.message.includes('not found')) {
            try {
              const groupsResponse = await this.client.get('/groups')
              const availableGroups = groupsResponse.data.value.map(g => g.displayName).slice(0, 10)
              
              return {
                success: false,
                message: `Group "${testGroupName}" not found.`,
                error: 'GROUP_NOT_FOUND',
                details: {
                  searched_group: testGroupName,
                  available_groups: availableGroups,
                  suggestion: 'Please verify the group name matches exactly (case-sensitive)'
                }
              }
            } catch (listError) {
              return {
                success: false,
                message: `Group "${testGroupName}" not found and cannot list available groups.`,
                error: 'GROUP_NOT_FOUND_NO_LIST'
              }
            }
          }
          
          throw groupError
        }
      }
      
      return { 
        success: true, 
        message: 'Azure AD connection and permissions verified successfully',
        details: {
          group_name: testGroupName,
          permissions_verified: ['Directory.Read.All', 'Group.Read.All', 'User.Read.All']
        }
      }
    } catch (error) {
      console.error('Connection test error:', error)
      return { 
        success: false, 
        message: `Connection failed: ${error.message}`,
        error: error.response?.data || error.message
      }
    }
  }
}

// Helper function to get an app-only access token for background sync
export async function getAppOnlyAccessToken() {
  try {
    const tokenUrl = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`
    
    const params = new URLSearchParams()
    params.append('client_id', process.env.AZURE_AD_CLIENT_ID)
    params.append('client_secret', process.env.AZURE_AD_CLIENT_SECRET)
    params.append('scope', 'https://graph.microsoft.com/.default')
    params.append('grant_type', 'client_credentials')

    const response = await axios.post(tokenUrl, params, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    })

    return response.data.access_token
  } catch (error) {
    console.error('Error getting app-only access token:', error)
    throw new Error(`Failed to get access token: ${error.response?.data?.error_description || error.message}`)
  }
}