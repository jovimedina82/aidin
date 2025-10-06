import { NextResponse } from 'next/server'
import { PrismaClient } from '@/lib/generated/prisma/index.js'

const prisma = new PrismaClient()

// Force this route to be dynamic (not cached)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    // Get all tickets with categories
    const tickets = await prisma.ticket.findMany({
      where: {
        category: {
          not: null
        }
      },
      select: {
        ticketNumber: true,
        category: true,
        departmentId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Get all departments
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true
      }
    })

    // Create department lookup map
    const departmentMap = new Map(departments.map(d => [d.id, d.name]))

    // Group tickets by category
    const categoryMap = new Map()

    tickets.forEach(ticket => {
      const category = ticket.category || 'Uncategorized'

      if (!categoryMap.has(category)) {
        categoryMap.set(category, {
          category,
          tickets: [],
          count: 0,
          departments: new Set()
        })
      }

      const categoryData = categoryMap.get(category)
      const departmentName = ticket.departmentId ? departmentMap.get(ticket.departmentId) || 'Unknown' : 'Unknown'

      categoryData.tickets.push({
        ticketNumber: ticket.ticketNumber,
        department: departmentName
      })
      categoryData.count++
      if (departmentName !== 'Unknown') {
        categoryData.departments.add(departmentName)
      }
    })

    // Convert to array and format
    const categoryAnalytics = Array.from(categoryMap.values())
      .map(item => ({
        category: item.category,
        count: item.count,
        tickets: item.tickets.map(t => t.ticketNumber),
        departments: Array.from(item.departments),
        ticketList: item.tickets.map(t => `${t.ticketNumber}`).join(', ')
      }))
      .sort((a, b) => b.count - a.count) // Sort by count descending

    return NextResponse.json({
      success: true,
      totalCategories: categoryAnalytics.length,
      totalTickets: tickets.length,
      categories: categoryAnalytics
    })

  } catch (error) {
    console.error('Error fetching category analytics:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch category analytics'
    }, { status: 500 })
  }
}
