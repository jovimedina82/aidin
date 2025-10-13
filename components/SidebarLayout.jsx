'use client'
import { useState, useMemo, useCallback, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import ProtectedRoute from './ProtectedRoute'
import Navbar from './Navbar'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Home,
  Ticket,
  Users,
  Building2,
  BookOpen,
  BarChart3,
  Settings,
  ChevronRight,
  User
} from 'lucide-react'

const navigation = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: Home,
    moduleKey: 'dashboard'
  },
  {
    name: 'Tickets',
    icon: Ticket,
    moduleKey: 'tickets',
    children: [
      { name: 'Your unsolved tickets', href: '/tickets?view=personal-open' },
      { name: 'Unassigned tickets', href: '/tickets?view=unassigned' },
      { name: 'All unsolved tickets', href: '/tickets?view=open' },
      { name: 'Pending tickets', href: '/tickets?view=pending' },
      { name: 'Recently solved tickets', href: '/tickets?view=solved' },
      { name: 'My open tickets', href: '/tickets?view=personal-open' },
      { name: 'My solved tickets', href: '/tickets?view=personal-solved' }
    ]
  },
  {
    name: 'Customers',
    href: '/users',
    icon: Users,
    moduleKey: 'users'
  },
  {
    name: 'Organizations',
    href: '/organizations',
    icon: Building2,
    moduleKey: 'organizations'
  },
  {
    name: 'Knowledge Base',
    href: '/knowledge-base',
    icon: BookOpen,
    moduleKey: 'knowledge-base'
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: BarChart3,
    moduleKey: 'reports'
  },
  {
    name: 'Admin',
    href: '/admin',
    icon: Settings,
    moduleKey: 'admin'
  }
]

const workSections = [
  {
    title: 'YOUR WORK',
    items: [
      { name: 'Tickets', href: '/tickets?view=personal' }
    ]
  },
  {
    title: 'SHARED WORK',
    items: [
      { name: 'Team tickets', href: '/tickets?view=team' }
    ]
  }
]

export default function SidebarLayout({ children }) {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [expandedItems, setExpandedItems] = useState({})
  const [userModules, setUserModules] = useState([])
  const [modulesLoading, setModulesLoading] = useState(true)

  // Fetch user's accessible modules
  useEffect(() => {
    const fetchModules = async () => {
      try {
        const response = await fetch('/api/user/modules')
        if (response.ok) {
          const data = await response.json()
          console.log('📦 Fetched user modules:', data.modules)
          console.log('📦 Module keys:', data.modules?.map(m => m.key))
          setUserModules(data.modules || [])
        } else {
          console.error('Failed to fetch modules, status:', response.status)
        }
      } catch (error) {
        console.error('Failed to fetch user modules:', error)
      } finally {
        setModulesLoading(false)
      }
    }

    if (user) {
      fetchModules()
    }
  }, [user])

  const toggleExpanded = useCallback((itemName) => {
    setExpandedItems(prev => ({
      ...prev,
      [itemName]: !prev[itemName]
    }))
  }, [])

  const isCurrentPage = useCallback((href) => {
    if (href === '/dashboard') return pathname === '/dashboard' || pathname === '/'
    return pathname.startsWith(href)
  }, [pathname])

  // Check if user has access to a module
  const hasModuleAccess = useCallback((moduleKey) => {
    if (!moduleKey) return true // If no moduleKey, show by default
    return userModules.some(m => m.key === moduleKey)
  }, [userModules])

  // Memoize filtered navigation to prevent recalculation
  const filteredNavigation = useMemo(() => {
    if (modulesLoading) return [] // Don't show navigation while loading

    const filtered = navigation.filter(item => {
      // Filter based on module access
      const hasAccess = hasModuleAccess(item.moduleKey)
      console.log(`🔍 Checking ${item.name} (${item.moduleKey}): ${hasAccess}`)
      return hasAccess
    })

    console.log('🔍 Filtered navigation items:', filtered.map(i => i.name))
    return filtered
  }, [modulesLoading, hasModuleAccess])

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="pt-4">
          <div className="container mx-auto px-4 pb-8">
          <div className="flex gap-6">
            {/* Sidebar */}
            <div className="w-64 rounded-lg shadow p-4 h-fit hidden lg:block" style={{ backgroundColor: '#3d6964' }}>
              <div className="p-4 space-y-1">
                {/* Main Navigation */}
                {filteredNavigation.map((item) => {
                      const hasChildren = item.children && item.children.length > 0
                      const isExpanded = expandedItems[item.name]
                      const isCurrent = item.href ? isCurrentPage(item.href) : false

                      return (
                        <div key={item.name}>
                          <button
                            onClick={() => {
                              if (hasChildren) {
                                toggleExpanded(item.name)
                              } else if (item.href) {
                                router.push(item.href)
                              }
                            }}
                            className={cn(
                              'w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md transition-colors',
                              isCurrent
                                ? 'bg-white/20 text-white border-r-2 border-white'
                                : 'text-white/80 hover:bg-white/10 hover:text-white'
                            )}
                          >
                            <div className="flex items-center">
                              <item.icon className="mr-3 h-5 w-5" />
                              <span>{item.name}</span>
                            </div>
                            {hasChildren && (
                              <ChevronRight
                                className={cn(
                                  'h-4 w-4 transition-transform',
                                  isExpanded && 'transform rotate-90'
                                )}
                              />
                            )}
                          </button>

                          {/* Submenu */}
                          {hasChildren && isExpanded && (
                            <div className="ml-8 mt-1 space-y-1">
                              {item.children.map((child) => (
                                <button
                                  key={child.name}
                                  onClick={() => router.push(child.href)}
                                  className={cn(
                                    'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                                    isCurrentPage(child.href)
                                      ? 'bg-white/20 text-white'
                                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                                  )}
                                >
                                  {child.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {/* Work Sections */}
                    <div className="pt-6">
                      {workSections.map((section) => (
                        <div key={section.title} className="mb-6">
                          <h3 className="px-3 text-xs font-semibold text-white/60 uppercase tracking-wider">
                            {section.title}
                          </h3>
                          <div className="mt-2 space-y-1">
                            {section.items.map((item) => (
                              <button
                                key={item.name}
                                onClick={() => router.push(item.href)}
                                className={cn(
                                  'w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors',
                                  isCurrentPage(item.href)
                                    ? 'bg-white/20 text-white'
                                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                                )}
                              >
                                {item.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* User Info */}
                    <div className="border-t border-white/20 pt-4 mt-6">
                      <div className="flex items-center px-3 py-2">
                        <div className="flex items-center">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                              <User className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <div className="ml-3 min-w-0 flex-1">
                            <p className="text-sm font-medium text-white truncate">
                              {user?.firstName} {user?.lastName}
                            </p>
                            <div className="flex gap-1">
                              {user?.roles?.map((role, index) => (
                                <span
                                  key={index}
                                  className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-white/20 text-white"
                                >
                                  {typeof role === 'string' ? role : role.name}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <main>
                {children}
              </main>
            </div>
          </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}