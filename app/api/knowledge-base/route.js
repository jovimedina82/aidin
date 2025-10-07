import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get URL search params for filtering
    const { searchParams } = new URL(request.url)
    const departmentId = searchParams.get('departmentId')
    const search = searchParams.get('search')

    // Build where clause
    const where = {
      isActive: true // Only show active articles
    }

    if (departmentId) {
      where.departmentId = departmentId
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } }
      ]
    }

    // Get all active knowledge base articles (available to all authenticated users)
    const articles = await prisma.knowledgeBase.findMany({
      where,
      include: {
        department: {
          select: {
            name: true,
            color: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Format articles for response
    const formattedArticles = articles.map(article => ({
      ...article,
      tags: article.tags ? JSON.parse(article.tags) : [],
      images: article.images ? JSON.parse(article.images) : [],
      // Don't expose embedding data to regular users
      embedding: undefined,
      usageCount: article.usageCount || 0
    }))

    return NextResponse.json({ articles: formattedArticles })

  } catch (error) {
    console.error('Error fetching knowledge base:', error)
    return NextResponse.json({ error: 'Failed to fetch knowledge base' }, { status: 500 })
  }
}
