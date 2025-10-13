'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '../../components/AuthProvider'
import ProtectedRoute from '../../components/ProtectedRoute'
import Navbar from '../../components/Navbar'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { User, Mail, Shield, Building, Calendar, Save } from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import UserEmailsManager from '../../components/UserEmailsManager'

export default function ProfilePage() {
  const { user, makeAuthenticatedRequest } = useAuth()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  })

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || ''
      })
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await makeAuthenticatedRequest(`/api/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        toast.success('Profile updated successfully!')
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update profile')
      }
    } catch (error) {
      toast.error('Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const initials = user
    ? (user.firstName && user.lastName
        ? `${user.firstName[0]}${user.lastName[0]}`
        : (user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'))
    : 'U'
  const isSSOUser = user?.azureId ? true : false

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
              <p className="text-muted-foreground">
                Manage your account information and preferences
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* Profile Info */}
              <div className="lg:col-span-3 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Personal Information
                    </CardTitle>
                    <CardDescription>
                      {isSSOUser
                        ? "Your personal information is managed through Azure AD"
                        : "Update your personal details and contact information"
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First Name</Label>
                          <Input
                            id="firstName"
                            value={formData.firstName}
                            onChange={(e) => handleChange('firstName', e.target.value)}
                            disabled={isSSOUser}
                            className={isSSOUser ? "opacity-50 cursor-not-allowed" : ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last Name</Label>
                          <Input
                            id="lastName"
                            value={formData.lastName}
                            onChange={(e) => handleChange('lastName', e.target.value)}
                            disabled={isSSOUser}
                            className={isSSOUser ? "opacity-50 cursor-not-allowed" : ""}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => handleChange('email', e.target.value)}
                          disabled={isSSOUser}
                          className={isSSOUser ? "opacity-50 cursor-not-allowed" : ""}
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={loading || isSSOUser}
                        className={isSSOUser ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {loading ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Account Security */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      Account Security
                    </CardTitle>
                    <CardDescription>
                      {isSSOUser
                        ? "Your account is managed through Azure AD Single Sign-On"
                        : "Manage your password and security settings"
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Password</h4>
                          <p className="text-sm text-muted-foreground">
                            {isSSOUser
                              ? "Managed by Azure AD"
                              : "Last updated: Never"
                            }
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSSOUser}
                          className={isSSOUser ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          Change Password
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">Two-Factor Authentication</h4>
                          <p className="text-sm text-muted-foreground">
                            {isSSOUser
                              ? "Managed by Azure AD security policies"
                              : "Add an extra layer of security to your account"
                            }
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isSSOUser}
                          className={isSSOUser ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          Enable 2FA
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Email Addresses Management */}
                <UserEmailsManager />
              </div>

              {/* Sidebar */}
              <div className="lg:col-span-2 space-y-6">
                {/* Profile Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-4">
                      <Avatar className="h-16 w-16 flex-shrink-0">
                        {user?.avatar && (
                          <AvatarImage src={user.avatar} alt={user.name || user.email || 'User'} />
                        )}
                        <AvatarFallback className="text-lg">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold">{user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}</h3>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail size={16} className="text-muted-foreground" />
                        <span className="text-sm text-muted-foreground break-all">{user?.email}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield size={16} className="text-muted-foreground" />
                        <span className="text-sm">Roles:</span>
                        <div className="flex gap-1">
                          {user?.roles?.map((role, index) => {
                            const roleName = typeof role === 'string' ? role : (role.role?.name || role.name || 'User');
                            return (
                              <Badge key={`${roleName}-${index}`} variant="secondary" className="text-xs">
                                {roleName}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                      
                      {user?.org && (
                        <div className="flex items-center gap-2">
                          <Building size={16} className="text-muted-foreground" />
                          <span className="text-sm">Organization:</span>
                          <span className="text-sm font-medium">{user.org.name}</span>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-muted-foreground" />
                        <span className="text-sm">Joined:</span>
                        <span className="text-sm">
                          {user?.createdAt ? formatDistanceToNow(new Date(user.createdAt), { addSuffix: true }) : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Mail className="mr-2 h-4 w-4" />
                      Email Preferences
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Shield className="mr-2 h-4 w-4" />
                      Privacy Settings
                    </Button>
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <User className="mr-2 h-4 w-4" />
                      Download Data
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}