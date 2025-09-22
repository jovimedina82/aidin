// Common types for the helpdesk application

export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  userType: 'Client' | 'Staff' | 'Manager' | 'Admin'
  managerId?: string
  isActive: boolean
  lastLoginAt?: Date
  createdAt: Date
  updatedAt: Date
  azureId?: string
  roles?: UserRole[]
  departments?: UserDepartment[]
  manager?: User
  directReports?: User[]
}

export interface Role {
  id: string
  name: string
  description?: string
  permissions: Record<string, any>
  createdAt: Date
  updatedAt: Date
}

export interface UserRole {
  id: string
  userId: string
  roleId: string
  role: Role
  user: User
}

export interface Department {
  id: string
  name: string
  description?: string
  color: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  users?: UserDepartment[]
  keywords?: DepartmentKeyword[]
  knowledgeBase?: KnowledgeBase[]
}

export interface UserDepartment {
  id: string
  userId: string
  departmentId: string
  user: User
  department: Department
}

export interface DepartmentKeyword {
  id: string
  departmentId: string
  keyword: string
  weight: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  department: Department
}

export type TicketStatus = 'NEW' | 'OPEN' | 'PENDING' | 'ON_HOLD' | 'SOLVED' | 'CLOSED'
export type TicketPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'

export interface Ticket {
  id: string
  ticketNumber: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  category?: string
  requesterId?: string
  assigneeId?: string
  departmentId?: string
  createdAt: Date
  updatedAt: Date
  resolvedAt?: Date
  closedAt?: Date
  comments?: TicketComment[]
  assignee?: User
  requester?: User
  aiDecision?: AIDecision
  kbUsage?: TicketKBUsage[]
}

export interface TicketComment {
  id: string
  ticketId: string
  userId: string
  content: string
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
  user: User
  ticket: Ticket
}

export interface KnowledgeBase {
  id: string
  title: string
  content: string
  tags?: string
  departmentId?: string
  isActive: boolean
  embedding?: string
  usageCount: number
  createdAt: Date
  updatedAt: Date
  department?: Department
  ticketResponses?: TicketKBUsage[]
}

export interface TicketKBUsage {
  id: string
  ticketId: string
  kbId: string
  relevance: number
  usedInResponse: boolean
  createdAt: Date
  ticket: Ticket
  knowledgeBase: KnowledgeBase
}

export interface AIDecision {
  id: string
  ticketId: string
  suggestedDepartment?: string
  departmentConfidence?: number
  keywordMatches?: string
  aiReasoning?: string
  finalDepartment?: string
  wasOverridden: boolean
  createdAt: Date
  ticket: Ticket
}

export interface WeeklyTicketStats {
  id: string
  weekStartDate: Date
  weekEndDate: Date
  year: number
  weekNumber: number
  totalTickets: number
  newTickets: number
  openTickets: number
  pendingTickets: number
  onHoldTickets: number
  solvedTickets: number
  closedTickets: number
  unassignedTickets: number
  effectiveness: number
  createdAt: Date
  updatedAt: Date
}

export interface UserPreference {
  id: string
  userId: string
  personalViewOrder?: string
  companyViewOrder?: string
  createdAt: Date
  updatedAt: Date
  user: User
}

// API Response types
export interface ApiResponse<T = any> {
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T = any> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Form types
export interface CreateTicketForm {
  title: string
  description: string
  priority: TicketPriority
}

export interface CreateUserForm {
  email: string
  firstName: string
  lastName: string
  password?: string
  phone?: string
  userType?: string
  isActive?: boolean
  departmentIds?: string[]
}

export interface LoginForm {
  email: string
  password: string
}

export interface RegisterForm {
  email: string
  password: string
  firstName: string
  lastName: string
}

// Hook types
export interface AsyncOperationOptions {
  onSuccess?: (result: any) => void
  onError?: (error: Error) => void
  showSuccessToast?: boolean
  showErrorToast?: boolean
  successMessage?: string
  errorMessage?: string
}

export interface FormValidationRule {
  required?: boolean
  minLength?: number
  maxLength?: number
  pattern?: RegExp
  message?: string
  validate?: (value: any, values: any) => string | null
}

export interface FormValidationRules {
  [key: string]: FormValidationRule
}

// Component prop types
export interface TicketCardProps {
  ticket: Ticket
  onClick?: (ticket: Ticket) => void
  showAssignee?: boolean
  showRequester?: boolean
}

export interface CreateTicketDialogProps {
  onTicketCreated?: (ticket: Ticket) => void
}

export interface DashboardLayoutProps {
  children: React.ReactNode
  title?: string
}

// Auth types
export interface AuthUser extends Omit<User, 'roles'> {
  roles: string[]
}

export interface AuthContextType {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (userData: RegisterForm) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  loading: boolean
  makeAuthenticatedRequest: (url: string, options?: RequestInit) => Promise<Response>
  isAuthenticated: boolean
}