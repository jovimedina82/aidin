'use client'

import { useAuth } from '@/components/AuthProvider'
import TagManager from '@/components/TagManager'
import { Loader2 } from 'lucide-react'

export default function TagManagementPage() {
  const { user, loading } = useAuth()

  // Check if user is admin or manager
  const isAdmin = user?.roles?.some(role =>
    ['Admin', 'Manager'].includes(role.role?.name || role.name)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-xl font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-red-600">Only admins and managers can access tag management.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-8">
      <TagManager />
    </div>
  )
}
