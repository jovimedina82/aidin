import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"


export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const preferences = await prisma.userPreference.findUnique({
      where: { userId: user.id }
    })

    return NextResponse.json({
      personalViewOrder: preferences?.personalViewOrder ? JSON.parse(preferences.personalViewOrder) : null,
      companyViewOrder: preferences?.companyViewOrder ? JSON.parse(preferences.companyViewOrder) : null,
      dashboardCardOrder: preferences?.dashboardCardOrder ? JSON.parse(preferences.dashboardCardOrder) : null
    })
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { personalViewOrder, companyViewOrder, dashboardCardOrder } = await request.json()

    const preferences = await prisma.userPreference.upsert({
      where: { userId: user.id },
      update: {
        personalViewOrder: personalViewOrder ? JSON.stringify(personalViewOrder) : null,
        companyViewOrder: companyViewOrder ? JSON.stringify(companyViewOrder) : null,
        dashboardCardOrder: dashboardCardOrder ? JSON.stringify(dashboardCardOrder) : null
      },
      create: {
        userId: user.id,
        personalViewOrder: personalViewOrder ? JSON.stringify(personalViewOrder) : null,
        companyViewOrder: companyViewOrder ? JSON.stringify(companyViewOrder) : null,
        dashboardCardOrder: dashboardCardOrder ? JSON.stringify(dashboardCardOrder) : null
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error saving user preferences:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}

export async function DELETE(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Reset to default order by deleting preferences
    await prisma.userPreference.deleteMany({
      where: { userId: user.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error resetting user preferences:', error)
    return NextResponse.json({ error: 'Failed to reset preferences' }, { status: 500 })
  }
}