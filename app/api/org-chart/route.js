import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"


export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get all employees (not clients) with their relationships and departments
    // Optimized: Don't include directReports since we'll build hierarchy from managerId
    const [employees, departmentCounts] = await Promise.all([
      prisma.user.findMany({
        where: {
          userType: 'Employee',
          isActive: true
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          managerId: true,
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          },
          departments: {
            include: {
              department: true
            }
          },
          roles: {
            include: {
              role: true
            }
          }
        },
        orderBy: [
          { firstName: 'asc' },
          { lastName: 'asc' }
        ]
      }),
      // Get department statistics from database instead of calculating in memory
      prisma.userDepartment.groupBy({
        by: ['departmentId'],
        _count: {
          userId: true
        },
        where: {
          user: {
            userType: 'Employee',
            isActive: true
          }
        }
      })
    ])

    // Build hierarchical structure
    const employeeMap = new Map()
    const rootEmployees = []

    // Create enhanced employee objects
    employees.forEach(emp => {
      const departments = emp.departments.map(ud => ud.department.name)
      const roles = emp.roles.map(ur => ur.role.name)

      // Determine primary role for display
      let primaryRole = 'Employee'
      if (roles.includes('Admin')) primaryRole = 'Admin'
      else if (roles.includes('Manager')) primaryRole = 'Manager'
      else if (roles.includes('Staff')) primaryRole = 'Staff'

      // Determine primary department
      let primaryDepartment = departments[0] || 'Unassigned'

      const enhancedEmployee = {
        id: emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        primaryRole,
        roles,
        primaryDepartment,
        departments,
        managerId: emp.manager?.id || null,
        manager: emp.manager,
        directReports: [],
        level: 0, // Will be calculated
        avatar: getAvatarInitials(emp.firstName, emp.lastName),
        isManager: roles.includes('Manager') || roles.includes('Admin'),
        departmentColor: getDepartmentColor(primaryDepartment)
      }

      employeeMap.set(emp.id, enhancedEmployee)
    })

    // Build hierarchy and calculate levels
    employees.forEach(emp => {
      const enhancedEmp = employeeMap.get(emp.id)

      if (emp.manager && employeeMap.has(emp.manager.id)) {
        // Add to manager's direct reports
        const manager = employeeMap.get(emp.manager.id)
        manager.directReports.push(enhancedEmp)
        enhancedEmp.level = manager.level + 1
      } else {
        // Root employee (no manager)
        rootEmployees.push(enhancedEmp)
        enhancedEmp.level = 0
      }
    })

    // Calculate levels correctly (multiple passes may be needed)
    let hasChanges = true
    while (hasChanges) {
      hasChanges = false
      employeeMap.forEach(emp => {
        if (emp.managerId && employeeMap.has(emp.managerId)) {
          const manager = employeeMap.get(emp.managerId)
          const newLevel = manager.level + 1
          if (emp.level !== newLevel) {
            emp.level = newLevel
            hasChanges = true
          }
        }
      })
    }

    // Get department statistics from the aggregated query
    const departmentMap = new Map()
    employees.forEach(emp => {
      emp.departments.forEach(ud => {
        departmentMap.set(ud.departmentId, ud.department)
      })
    })

    const departmentStats = departmentCounts.map(stat => {
      const dept = departmentMap.get(stat.departmentId)
      return {
        name: dept?.name || 'Unknown',
        count: stat._count.userId,
        color: getDepartmentColor(dept?.name || 'Unknown')
      }
    })

    return NextResponse.json({
      employees: Array.from(employeeMap.values()),
      hierarchy: rootEmployees,
      departmentStats: Object.values(departmentStats),
      totalEmployees: employees.length,
      levels: Math.max(...Array.from(employeeMap.values()).map(emp => emp.level)) + 1
    })

  } catch (error) {
    console.error('Error fetching org chart:', error)
    return NextResponse.json({ error: 'Failed to fetch organizational chart' }, { status: 500 })
  }
}

function getAvatarInitials(firstName, lastName) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase()
}

function getDepartmentColor(department) {
  const colors = {
    'Marketing Department': '#F59E0B', // Amber
    'Information Technology': '#3B82F6', // Blue
    'Operations': '#10B981', // Emerald
    'Accounting': '#8B5CF6', // Violet
    'Human Resources': '#EF4444', // Red
    'Finance': '#06B6D4', // Cyan
    'Sales': '#F97316', // Orange
    'Unassigned': '#6B7280' // Gray
  }
  return colors[department] || '#6B7280'
}