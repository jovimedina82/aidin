'use client'
import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { Ticket, Users, BarChart3, Settings, LogOut, Book, Plus, UserCheck } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

export default function Navbar() {
  const { user, logout } = useAuth()
  const [isScrolled, setIsScrolled] = useState(false)

  const initials = user ? `${user.firstName[0]}${user.lastName[0]}` : 'U'

  // Role-based permissions
  const isStaff = user?.roles?.some(role => ['Admin', 'Manager', 'Staff'].includes(role))
  const isAdmin = user?.roles?.some(role => ['Admin', 'Manager'].includes(role))
  const isRequester = user?.roles?.includes('Requester')

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      setIsScrolled(scrollTop > 10)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`surterre-nav fixed top-0 left-0 right-0 z-50 border-b border-border transition-all duration-300 ${
        isScrolled
          ? 'backdrop-blur-md shadow-lg'
          : ''
      }`}
      style={{
        backgroundColor: isScrolled ? '#3d6964cc' : '#3d6964'
      }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center space-x-8">
            <Link href="/dashboard" className="surterre-logo">
              <div className="w-20 h-20 flex items-center justify-center rounded-full overflow-hidden bg-white">
                <Image src="/images/aidin-logo.png" alt="Aidin Logo" width={76} height={76} className="object-contain" />
              </div>
              <div className="surterre-logo-text">
                <div className="surterre-logo-title text-white text-xl font-bold">AIDIN</div>
                <div className="surterre-logo-subtitle text-white/80 text-sm">HELPDESK</div>
              </div>
            </Link>
            
            <div className="hidden md:flex space-x-4">
              {/* Dashboard - Available to all */}
              <Link href="/dashboard" className="flex items-center space-x-2 text-white/80 hover:text-white">
                <BarChart3 size={16} />
                <span>Dashboard</span>
              </Link>

              {/* Tickets - Available to all */}
              <Link href="/tickets" className="flex items-center space-x-2 text-white/80 hover:text-white">
                <Ticket size={16} />
                <span>Tickets</span>
              </Link>

              {/* Knowledge Base - Available to all */}
              <Link href="/knowledge-base" className="flex items-center space-x-2 text-white/80 hover:text-white">
                <Book size={16} />
                <span>Knowledge Base</span>
              </Link>

              {/* Staff/Admin only sections */}
              {isStaff && (
                <>
                  <Link href="/users" className="flex items-center space-x-2 text-white/80 hover:text-white">
                    <Users size={16} />
                    <span>Users</span>
                  </Link>
                </>
              )}

              {/* Admin only sections */}
              {isAdmin && (
                <Link href="/admin" className="flex items-center space-x-2 text-white/80 hover:text-white">
                  <Settings size={16} />
                  <span>Admin</span>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Create Ticket Button - Available to all */}
            <Link href="/tickets/new">
              <Button size="sm" className="surterre-btn surterre-btn-primary">
                <Plus className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    {user?.avatar && (
                      <AvatarImage src={user.avatar} alt={`${user.firstName} ${user.lastName}`} />
                    )}
                    <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">{user?.firstName} {user?.lastName}</p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">
                      {user?.email}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {user?.roles?.map((role) => (
                        <span key={role} className="text-xs bg-muted px-2 py-1 rounded">
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <DropdownMenuSeparator />
                
                {/* Mobile menu items */}
                <div className="md:hidden">
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/tickets" className="flex items-center">
                      <Ticket className="mr-2 h-4 w-4" />
                      Tickets
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/knowledge-base" className="flex items-center">
                      <Book className="mr-2 h-4 w-4" />
                      Knowledge Base
                    </Link>
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem asChild>
                      <Link href="/users" className="flex items-center">
                        <Users className="mr-2 h-4 w-4" />
                        Users
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center">
                        <Settings className="mr-2 h-4 w-4" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                </div>

                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center">
                    <UserCheck className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}