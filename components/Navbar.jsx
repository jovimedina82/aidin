'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from './AuthProvider'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  BarChart3,
  Ticket,
  Book,
  Users,
  Settings,
  Ban,
  Plus,
  Menu,
  X,
  UserCircle,
  LogOut,
  UserCheck,
  Sparkles,
} from 'lucide-react'

export default function Navbar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobileMenuOpen])

  const userRoleNames = user?.roles?.map(role =>
    typeof role === 'string' ? role : (role.role?.name || role.name)
  ) || []

  const isStaff = userRoleNames.some(role => ['Admin', 'Manager', 'Staff'].includes(role))
  const isAdmin = userRoleNames.some(role => ['Admin', 'Manager'].includes(role))

  const initials = user
    ? (user.firstName && user.lastName
        ? `${user.firstName[0]}${user.lastName[0]}`
        : (user.name ? user.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'U'))
    : 'U'

  // Main navigation items - core user-facing features
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', tooltip: 'View tickets overview and statistics', icon: BarChart3, show: true },
    { href: '/tickets', label: 'Tickets', tooltip: 'Manage and view all support tickets', icon: Ticket, show: true },
    { href: '/knowledge-base', label: 'Knowledge Base', tooltip: 'Browse help articles and solutions', icon: Book, show: true },
    { href: '/staff-directory', label: 'Staff Directory', tooltip: 'View staff availability and locations', icon: UserCheck, show: true },
    { href: '/aidin-chat', label: 'AidIN Chat', tooltip: 'AI assistant for technical support and queries', icon: Sparkles, show: isStaff },
  ]

  // Admin navigation items - shown in dropdown menu
  const adminItems = [
    { href: '/users', label: 'User Management', icon: Users, show: isStaff },
    { href: '/admin', label: 'Settings', icon: Settings, show: isAdmin },
    { href: '/admin/blocked-domains', label: 'Blocked Senders', icon: Ban, show: isAdmin },
  ]

  const isActive = (href) => pathname === href || pathname?.startsWith(`${href}/`)

  return (
    <TooltipProvider delayDuration={300}>
      <nav
        aria-label="Primary"
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          isScrolled
            ? 'bg-[hsl(var(--primary))]/95 backdrop-blur-md shadow-lg'
            : 'bg-[hsl(var(--primary))] shadow-sm'
        }`}
        style={{ height: 'var(--nav-h, 64px)' }}
      >
        <div className="max-w-[1400px] mx-auto pl-0 pr-4 sm:pr-6 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo - Left */}
            <Link
              href="/dashboard"
              className="flex items-center group focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))] rounded-lg"
            >
              <div className="relative h-16 transition-transform group-hover:scale-105">
                <Image
                  src="/images/Official-Logo.png"
                  alt="Aidin Helpdesk"
                  width={260}
                  height={64}
                  className="object-contain h-16 opacity-95 group-hover:opacity-100 transition-opacity"
                  priority
                />
              </div>
            </Link>

            {/* Desktop Navigation - Center */}
            <div className="hidden lg:flex items-center gap-1 flex-1 justify-center max-w-2xl mx-auto">
              {navItems.filter(item => item.show).map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>
                      <Link
                        href={item.href}
                        className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:bg-white/10 ${
                          active
                            ? 'text-white'
                            : 'text-white/80 hover:text-white'
                        }`}
                      >
                        <Icon size={18} strokeWidth={2} />
                        <span>{item.label}</span>
                        {active && (
                          <motion.div
                            layoutId="navbar-indicator"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-[hsl(var(--accent))]"
                            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                          />
                        )}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{item.tooltip || item.label}</p>
                    </TooltipContent>
                  </Tooltip>
                )
              })}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[hsl(var(--accent))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X size={24} strokeWidth={2} />
              ) : (
                <Menu size={24} strokeWidth={2} />
              )}
            </button>

            {/* Right Actions - Buttons and User Menu */}
            <div className="flex items-center gap-3">
              {/* New Ticket Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/tickets/new">
                    <Button
                      size="sm"
                      className="bg-white hover:bg-white/95 text-[hsl(var(--primary))] font-medium shadow-sm hover:shadow-md transition-all h-9 px-4"
                    >
                      <Plus className="mr-2 h-4 w-4" strokeWidth={2.5} />
                      <span className="hidden sm:inline">New Ticket</span>
                      <span className="sm:hidden">New</span>
                    </Button>
                  </Link>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Create a new support ticket</p>
                </TooltipContent>
              </Tooltip>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-10 w-10 rounded-full hover:bg-white/10 p-0 focus:ring-2 focus:ring-[hsl(var(--accent))] focus:ring-offset-2 focus:ring-offset-[hsl(var(--primary))]"
                  >
                    <Avatar className="h-10 w-10 ring-2 ring-white/20 transition-transform hover:scale-105">
                      {user?.avatar && (
                        <AvatarImage src={user.avatar} alt={user.name || user.email || 'User'} />
                      )}
                      <AvatarFallback className="text-sm bg-white/20 text-white font-medium">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end" forceMount>
                  {/* User Profile Section */}
                  <div className="flex items-start gap-3 p-3">
                    <Avatar className="h-12 w-12">
                      {user?.avatar && (
                        <AvatarImage src={user.avatar} alt={user.name || user.email || 'User'} />
                      )}
                      <AvatarFallback className="text-sm">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col space-y-1 flex-1 min-w-0">
                      <p className="text-sm font-medium leading-none truncate">
                        {user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {user?.roles?.slice(0, 3).map((role, index) => {
                          const roleName = typeof role === 'string' ? role : (role.role?.name || role.name || 'User')
                          return (
                            <span
                              key={`${roleName}-${index}`}
                              className="text-[10px] bg-muted px-2 py-0.5 rounded"
                            >
                              {roleName}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Personal Section */}
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center">
                      <UserCircle className="mr-2 h-4 w-4" />
                      My Profile
                    </Link>
                  </DropdownMenuItem>

                  {/* Admin Section */}
                  {(isStaff || isAdmin) && (
                    <>
                      <DropdownMenuSeparator />
                      <div className="px-2 py-1.5">
                        <p className="text-xs font-semibold text-muted-foreground">Administration</p>
                      </div>
                      {adminItems.filter(item => item.show).map((item) => {
                        const Icon = item.icon
                        return (
                          <DropdownMenuItem key={item.href} asChild>
                            <Link href={item.href} className="flex items-center">
                              <Icon className="mr-2 h-4 w-4" />
                              {item.label}
                            </Link>
                          </DropdownMenuItem>
                        )
                      })}
                    </>
                  )}

                  <DropdownMenuSeparator />

                  {/* Logout */}
                  <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="lg:hidden overflow-hidden border-t border-white/10 bg-[hsl(var(--primary))]/98 backdrop-blur-md"
            >
              <div className="px-4 py-4 space-y-1 max-h-[calc(100vh-var(--nav-h,64px))] overflow-y-auto">
                {/* Main Navigation */}
                {navItems.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                        active
                          ? 'bg-white/15 text-white'
                          : 'text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20'
                      }`}
                    >
                      <Icon size={20} strokeWidth={2} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}

                {/* Admin Section for Mobile */}
                {(isStaff || isAdmin) && adminItems.filter(item => item.show).length > 0 && (
                  <>
                    <div className="px-4 pt-4 pb-2">
                      <p className="text-xs font-semibold text-white/60 uppercase tracking-wider">Administration</p>
                    </div>
                    {adminItems.filter(item => item.show).map((item) => {
                      const Icon = item.icon
                      const active = isActive(item.href)
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${
                            active
                              ? 'bg-white/15 text-white'
                              : 'text-white/80 hover:text-white hover:bg-white/10 active:bg-white/20'
                          }`}
                        >
                          <Icon size={20} strokeWidth={2} />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </TooltipProvider>
  )
}
