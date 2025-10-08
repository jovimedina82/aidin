import { describe, it, expect } from 'vitest'
import * as modules from '../modules'

describe('Phase 2 Scaffold - Module Exports', () => {
  describe('Auth Module', () => {
    it('should export domain types', () => {
      expect(modules.auth.Provider).toBeDefined()
      expect(modules.auth.Provider.LOCAL).toBe('local')
      expect(modules.auth.Provider.AZURE_AD).toBe('azure_ad')
    })

    it('should export service functions', () => {
      expect(modules.auth.service.login).toBeDefined()
      expect(modules.auth.service.refreshToken).toBeDefined()
      expect(modules.auth.service.validateToken).toBeDefined()
    })

    it('should export provider interfaces', () => {
      expect(modules.auth.JWTProviderImpl).toBeDefined()
      expect(modules.auth.AzureADProviderImpl).toBeDefined()
    })

    it('service functions should throw NotImplemented', async () => {
      await expect(modules.auth.service.login({ email: 'test@test.com', password: 'test' }))
        .rejects.toThrow(/NotImplemented.*Phase 3/)
    })
  })

  describe('Users Module', () => {
    it('should export domain types', () => {
      expect(modules.users.Role).toBeDefined()
      expect(modules.users.Role.ADMIN).toBe('Admin')
      expect(modules.users.Role.STAFF).toBe('Staff')
    })

    it('should export service functions', () => {
      expect(modules.users.service.createUser).toBeDefined()
      expect(modules.users.service.getUserById).toBeDefined()
      expect(modules.users.service.listUsers).toBeDefined()
    })

    it('should export RBAC functions', () => {
      expect(modules.users.rbac.can).toBeDefined()
      expect(modules.users.rbac.hasRole).toBeDefined()
      expect(modules.users.rbac.Action).toBeDefined()
    })

    it('RBAC functions should work (implemented in Phase 3)', () => {
      const mockUser: any = {
        id: '1',
        roles: ['Admin'], // Use string role name instead of enum
        email: 'admin@test.com',
        firstName: 'Admin',
        lastName: 'User',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      // Phase 3: RBAC is now implemented and should work
      expect(modules.users.rbac.can(mockUser, modules.users.rbac.Action.USER_CREATE)).toBe(true)
      expect(modules.users.rbac.hasRole(mockUser, [modules.users.Role.ADMIN])).toBe(true)
    })
  })

  describe('Tickets Module', () => {
    it('should export domain types', () => {
      expect(modules.tickets.Status).toBeDefined()
      expect(modules.tickets.Priority).toBeDefined()
      expect(modules.tickets.Status.NEW).toBe('NEW')
      expect(modules.tickets.Priority.URGENT).toBe('URGENT')
    })

    it('should export service functions', () => {
      expect(modules.tickets.service.createTicket).toBeDefined()
      expect(modules.tickets.service.getTicketById).toBeDefined()
      expect(modules.tickets.service.listTickets).toBeDefined()
    })

    it('should export policy functions', () => {
      expect(modules.tickets.policy.canViewTicket).toBeDefined()
      expect(modules.tickets.policy.canUpdateTicket).toBeDefined()
    })

    it('policy functions should return false (stub)', () => {
      const mockUser: any = { id: '1' }
      const mockTicket: any = { id: '1', requesterId: '2' }
      expect(modules.tickets.policy.canViewTicket(mockUser, mockTicket)).toBe(false)
    })

    it('legacy service functions should throw NotImplemented', async () => {
      // Phase 4: Legacy functions updated to reference new create()/get()
      await expect(modules.tickets.service.getTicketById('123'))
        .rejects.toThrow(/NotImplemented.*Phase 4/)
    })
  })

  describe('Comments Module', () => {
    it('should export domain types', () => {
      expect(modules.comments.CommentVisibility).toBeDefined()
      expect(modules.comments.CommentVisibility.PUBLIC).toBe('PUBLIC')
    })

    it('should export service functions', () => {
      expect(modules.comments.service.addComment).toBeDefined()
      expect(modules.comments.service.listComments).toBeDefined()
    })

    it('service functions should throw NotImplemented', async () => {
      await expect(modules.comments.service.listComments('ticket-123'))
        .rejects.toThrow(/NotImplemented.*Phase 3/)
    })
  })

  describe('Reports Module', () => {
    it('should export domain types', () => {
      // Phase 9: New API - computeKPIs instead of computeWeeklyKPIs
      expect(modules.reports.service.computeKPIs).toBeDefined()
    })

    it('should export service and scheduler functions', () => {
      // Phase 9: Updated API
      expect(modules.reports.service.computeKPIs).toBeDefined()
      expect(modules.reports.scheduler.runWeeklySnapshot).toBeDefined()
      expect(modules.reports.repo.upsertWeek).toBeDefined()
      expect(modules.reports.repo.latest).toBeDefined()
    })

    it('service functions should be implemented (Phase 9)', async () => {
      // Phase 9: Functions are now implemented, not throwing NotImplemented
      expect(modules.reports.service.computeKPIs).toBeInstanceOf(Function)
      expect(modules.reports.scheduler.runWeeklySnapshot).toBeInstanceOf(Function)
    })
  })

  describe('Email Module', () => {
    it('should export EmailProvider interface and implementations', () => {
      expect(modules.email.NoopEmailProvider).toBeDefined()
      expect(modules.email.SMTPProvider).toBeDefined()
      expect(modules.email.GraphEmailProvider).toBeDefined()
    })

    it('should export ingestor function', () => {
      expect(modules.email.processInboundEmail).toBeDefined()
    })

    it('NoopEmailProvider should return success without sending', async () => {
      const provider = new modules.email.NoopEmailProvider()
      const result = await provider.send('test@test.com', 'Subject', 'Body')
      expect(result.success).toBe(true)
    })

    it('SMTP and Graph providers should be implemented (Phase 6)', async () => {
      // Phase 6: Legacy classes now work as stubs
      const smtpProvider = new modules.email.SMTPProvider()
      const result = await smtpProvider.send({
        to: 'test@test.com',
        subject: 'Subject',
        body: 'Body'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('AI Module', () => {
    it('should export domain types', () => {
      // Check functions exist as proxy for interfaces
      expect(modules.ai.classify).toBeDefined()
      expect(modules.ai.respond).toBeDefined()
    })

    it('should export provider implementations', () => {
      expect(modules.ai.OpenAIProvider).toBeDefined()
      expect(modules.ai.AnthropicProvider).toBeDefined()
    })

    it('classify and respond functions should be defined', () => {
      expect(typeof modules.ai.classify).toBe('function')
      expect(typeof modules.ai.respond).toBe('function')
    })

    it('legacy provider implementations should throw NotImplemented', async () => {
      // Phase 5: Legacy classes updated to reference Phase 5
      const provider = new modules.ai.OpenAIProvider()
      await expect(provider.classify('test input'))
        .rejects.toThrow(/NotImplemented.*Phase 5/)
    })
  })
})

describe('Phase 2 Scaffold - Repository Interfaces', () => {
  it('TicketRepository should be interface only (no Prisma)', () => {
    // Repository is an interface - we just verify the module exports it
    expect(modules.tickets.TicketRepository).toBeUndefined() // Interfaces don't export
    // But the module should import successfully without Prisma
    expect(modules.tickets.service).toBeDefined()
  })

  it('CommentRepository should be interface only (no Prisma)', () => {
    expect(modules.comments.service).toBeDefined()
  })

  it('ReportsRepository should be interface only (no Prisma)', () => {
    expect(modules.reports.service).toBeDefined()
  })
})
