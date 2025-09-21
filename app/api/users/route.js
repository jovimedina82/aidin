import { NextResponse } from 'next/server'
import { PrismaClient } from '../../../lib/generated/prisma/index.js'

const prisma = new PrismaClient()

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: true
          }
        },
        departments: {
          include: {
            department: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function POST(request) {
  try {
    const data = await request.json()

    const user = await prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        phone: data.phone,
        isActive: data.isActive ?? true
      },
      include: {
        roles: {
          include: {
            role: true
          }
        },
        departments: {
          include: {
            department: true
          }
        }
      }
    })

    // If departments are provided, create the department assignments
    if (data.departmentIds && Array.isArray(data.departmentIds)) {
      for (const departmentId of data.departmentIds) {
        await prisma.userDepartment.create({
          data: {
            userId: user.id,
            departmentId: departmentId
          }
        })
      }
    } else if (data.departmentId) {
      // Handle single department for backward compatibility
      await prisma.userDepartment.create({
        data: {
          userId: user.id,
          departmentId: data.departmentId
        }
      })
    }

    return NextResponse.json(user, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    )
  }
}