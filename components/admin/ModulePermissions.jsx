'use client'
import { useState, useEffect } from 'react'
import { Check, X, RefreshCw, Shield, Lock, Unlock, Search } from 'lucide-react'
import { useAuth } from '../AuthProvider'

export default function ModulePermissions() {
  const { makeAuthenticatedRequest } = useAuth()
  const [users, setUsers] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [userModules, setUserModules] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userSearchTerm, setUserSearchTerm] = useState('')

  // Fetch all users on component mount
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await makeAuthenticatedRequest('/api/users')
      if (response.ok) {
        const data = await response.json()
        // Handle both array format and object with users property
        const usersArray = Array.isArray(data) ? data : data.users || []
        console.log('Fetched users:', usersArray)
        setUsers(usersArray)
      } else {
        console.error('Failed to fetch users:', response.status)
      }
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchUserModules = async (userId) => {
    setLoading(true)
    try {
      const response = await makeAuthenticatedRequest(`/api/admin/user-modules?userId=${userId}`)
      if (response.ok) {
        const data = await response.json()
        setUserModules(data.modules || [])
      }
    } catch (error) {
      console.error('Failed to fetch user modules:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUserSelect = (user) => {
    setSelectedUser(user)
    fetchUserModules(user.id)
  }

  const toggleModuleAccess = async (module) => {
    if (module.isCore) {
      alert('Core modules cannot be modified')
      return
    }

    setSaving(true)
    try {
      const newAccessValue = !module.hasAccess

      const response = await makeAuthenticatedRequest('/api/admin/user-modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUser.id,
          moduleKey: module.key,
          hasAccess: newAccessValue
        })
      })

      if (response.ok) {
        // Refresh the module list
        await fetchUserModules(selectedUser.id)
      } else {
        const error = await response.json()
        alert(`Failed to update access: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to toggle module access:', error)
      alert('Failed to update module access')
    } finally {
      setSaving(false)
    }
  }

  const removeUserOverride = async (module) => {
    if (module.accessReason !== 'user-override-granted' && module.accessReason !== 'user-override-denied') {
      alert('No user override to remove')
      return
    }

    setSaving(true)
    try {
      const response = await makeAuthenticatedRequest(
        `/api/admin/user-modules?userId=${selectedUser.id}&moduleKey=${module.key}`,
        { method: 'DELETE' }
      )

      if (response.ok) {
        // Refresh the module list
        await fetchUserModules(selectedUser.id)
      } else {
        const error = await response.json()
        alert(`Failed to remove override: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Failed to remove override:', error)
      alert('Failed to remove user override')
    } finally {
      setSaving(false)
    }
  }

  // Filter users based on search term
  const filteredUsers = users.filter(user => {
    const searchLower = userSearchTerm.toLowerCase()
    return (
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    )
  })

  const getAccessBadge = (module) => {
    if (module.isCore) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
          <Shield className="w-3 h-3 mr-1" />
          Core
        </span>
      )
    }

    if (module.accessReason === 'user-override-granted') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          <Unlock className="w-3 h-3 mr-1" />
          User Override (Granted)
        </span>
      )
    }

    if (module.accessReason === 'user-override-denied') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
          <Lock className="w-3 h-3 mr-1" />
          User Override (Denied)
        </span>
      )
    }

    if (module.accessReason === 'role-based') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
          Role-Based
        </span>
      )
    }

    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-600">
        Denied
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Module Permissions</h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage module access for individual users. User-specific overrides take precedence over role-based access.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Selection */}
        <div className="bg-white shadow rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select User</h3>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={userSearchTerm}
                onChange={(e) => setUserSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {filteredUsers.length} of {users.length} users
            </p>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                {userSearchTerm ? 'No users match your search' : 'No users found'}
              </div>
            ) : (
              filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => handleUserSelect(user)}
                className={`w-full text-left px-3 py-2 rounded-md transition-colors ${
                  selectedUser?.id === user.id
                    ? 'bg-blue-100 text-blue-900 font-medium'
                    : 'hover:bg-gray-100 text-gray-700'
                }`}
              >
                <div className="font-medium">{user.firstName} {user.lastName}</div>
                <div className="text-xs text-gray-500">{user.email}</div>
                <div className="flex gap-1 mt-1">
                  {user.roles?.map((userRole, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-gray-200 text-gray-700"
                    >
                      {userRole.role?.name || userRole.name}
                    </span>
                  ))}
                </div>
              </button>
              ))
            )}
          </div>
        </div>

        {/* Module List */}
        <div className="lg:col-span-2 bg-white shadow rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedUser ? `Modules for ${selectedUser.firstName} ${selectedUser.lastName}` : 'Select a user'}
            </h3>
            {selectedUser && (
              <button
                onClick={() => fetchUserModules(selectedUser.id)}
                disabled={loading}
                className="p-2 text-gray-600 hover:text-gray-900 disabled:opacity-50"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {!selectedUser && (
            <div className="text-center py-12 text-gray-500">
              Select a user to manage their module permissions
            </div>
          )}

          {selectedUser && loading && (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="mt-2 text-gray-500">Loading modules...</p>
            </div>
          )}

          {selectedUser && !loading && (
            <div className="space-y-2">
              {userModules.map((module) => (
                <div
                  key={module.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-gray-900">{module.name}</h4>
                        {getAccessBadge(module)}
                      </div>
                      {module.description && (
                        <p className="text-sm text-gray-600 mt-1">{module.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>Key: {module.key}</span>
                        {module.category && <span>Category: {module.category}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {/* Toggle Access Button */}
                      <button
                        onClick={() => toggleModuleAccess(module)}
                        disabled={saving || module.isCore}
                        className={`p-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          module.hasAccess
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-red-100 text-red-700 hover:bg-red-200'
                        }`}
                        title={module.isCore ? 'Core modules cannot be modified' : (module.hasAccess ? 'Revoke access' : 'Grant access')}
                      >
                        {module.hasAccess ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <X className="w-5 h-5" />
                        )}
                      </button>

                      {/* Remove Override Button */}
                      {(module.accessReason === 'user-override-granted' || module.accessReason === 'user-override-denied') && (
                        <button
                          onClick={() => removeUserOverride(module)}
                          disabled={saving}
                          className="p-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                          title="Remove user override (revert to role-based access)"
                        >
                          <RefreshCw className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {userModules.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No modules found
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">Legend:</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            <span><strong>Core:</strong> Cannot be disabled (Dashboard, Profile)</span>
          </div>
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4" />
            <span><strong>User Override (Granted):</strong> Explicitly granted to this user</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            <span><strong>User Override (Denied):</strong> Explicitly denied for this user</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 bg-gray-300 rounded"></span>
            <span><strong>Role-Based:</strong> Access granted through user's role(s)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
