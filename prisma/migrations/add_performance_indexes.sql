-- Performance optimization indexes for frequently queried columns
-- Created: 2025-10-06

-- Tickets table indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigneeId ON tickets(assigneeId);
CREATE INDEX IF NOT EXISTS idx_tickets_requesterId ON tickets(requesterId);
CREATE INDEX IF NOT EXISTS idx_tickets_departmentId ON tickets(departmentId);
CREATE INDEX IF NOT EXISTS idx_tickets_updatedAt ON tickets(updatedAt);
CREATE INDEX IF NOT EXISTS idx_tickets_createdAt ON tickets(createdAt);
CREATE INDEX IF NOT EXISTS idx_tickets_emailConversationId ON tickets(emailConversationId);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_tickets_status_assigneeId ON tickets(status, assigneeId);
CREATE INDEX IF NOT EXISTS idx_tickets_status_updatedAt ON tickets(status, updatedAt);

-- Ticket comments indexes
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticketId ON ticket_comments(ticketId);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_userId ON ticket_comments(userId);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_createdAt ON ticket_comments(createdAt);

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_isActive ON users(isActive);
CREATE INDEX IF NOT EXISTS idx_users_userType ON users(userType);

-- Knowledge base indexes
CREATE INDEX IF NOT EXISTS idx_knowledge_base_departmentId ON knowledge_base(departmentId);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_isActive ON knowledge_base(isActive);

-- Department keywords indexes
CREATE INDEX IF NOT EXISTS idx_department_keywords_departmentId ON department_keywords(departmentId);
CREATE INDEX IF NOT EXISTS idx_department_keywords_isActive ON department_keywords(isActive);
