'use client'
import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, Building, Calendar, Shield, User } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function UserProfileModal({ isOpen, onClose, userId }) {
  const { makeAuthenticatedRequest } = useAuth()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && userId) {
      fetchUser()
    }
  }, [isOpen, userId])

  const fetchUser = async () => {
    setLoading(true)
    try {
      const response = await makeAuthenticatedRequest(`/api/users/${userId}`)
      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      }
    } catch (error) {
      console.error('Failed to fetch user:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : '??'

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>User Profile</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : user ? (
          <div className="space-y-6">
            {/* User Header */}
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                {user.avatar && (
                  <AvatarImage src={user.avatar} alt={`${user.firstName} ${user.lastName}`} />
                )}
                <AvatarFallback className="text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg">{user.firstName} {user.lastName}</h3>
                {user.jobTitle && (
                  <p className="text-sm text-muted-foreground">{user.jobTitle}</p>
                )}
              </div>
            </div>

            {/* User Details */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Mail size={16} className="text-muted-foreground" />
                  <span className="text-sm break-all">{user.email}</span>
                </div>

                {user.phone && (
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-muted-foreground" />
                    <span className="text-sm">{user.phone}</span>
                  </div>
                )}

                {user.officeLocation && (
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-muted-foreground" />
                    <span className="text-sm">{user.officeLocation}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Shield size={16} className="text-muted-foreground" />
                  <span className="text-sm">Roles:</span>
                  <div className="flex gap-1 flex-wrap">
                    {user.roles?.map((roleData) => {
                      const roleName = roleData.role?.name || roleData.name || roleData
                      return (
                        <Badge key={roleName} variant="secondary" className="text-xs">
                          {roleName}
                        </Badge>
                      )
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-muted-foreground" />
                  <span className="text-sm">Joined:</span>
                  <span className="text-sm">
                    {user.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : 'Unknown'}
                  </span>
                </div>

                {user.azureId && (
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-muted-foreground" />
                    <Badge variant="outline" className="text-xs">
                      Azure AD User
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">User not found</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}