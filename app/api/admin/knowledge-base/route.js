import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { generateEmbedding } from '../../../../lib/ai/knowledge-search.js'


export async function GET(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin access
    const userRoles = user?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isAdmin = roleNames.includes('Admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get all knowledge base articles
    const articles = await prisma.knowledgeBase.findMany({
      include: {
        department: {
          select: {
            name: true,
            color: true
          }
        },
        ticketResponses: {
          select: {
            id: true,
            usedInResponse: true,
            relevance: true
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    })

    // Add usage statistics
    const articlesWithStats = articles.map(article => ({
      ...article,
      tags: article.tags ? JSON.parse(article.tags) : [],
      hasEmbedding: !!article.embedding,
      totalUsage: article.ticketResponses.length,
      responseUsage: article.ticketResponses.filter(tr => tr.usedInResponse).length
    }))

    return NextResponse.json({ articles: articlesWithStats })

  } catch (error) {
    console.error('Error fetching knowledge base:', error)
    return NextResponse.json({ error: 'Failed to fetch knowledge base' }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin access
    const userRoles = user?.roles || []
    const roleNames = userRoles.map(role =>
      typeof role === 'string' ? role : (role.role?.name || role.name)
    )
    const isAdmin = roleNames.includes('Admin')

    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const data = await request.json()
    const { title, content, tags, departmentId } = data

    // Validate required fields
    if (!title || !content) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    // Generate embedding for the article
    const text = `${title}\n\n${content}`
    const embedding = await generateEmbedding(text)

    // Create new knowledge base article
    const newArticle = await prisma.knowledgeBase.create({
      data: {
        title,
        content,
        tags: tags ? JSON.stringify(tags) : null,
        departmentId: departmentId || null,
        embedding: embedding ? JSON.stringify(embedding) : null
      },
      include: {
        department: {
          select: {
            name: true,
            color: true
          }
        }
      }
    })

    return NextResponse.json({
      ...newArticle,
      tags: newArticle.tags ? JSON.parse(newArticle.tags) : [],
      hasEmbedding: !!newArticle.embedding
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating knowledge base article:', error)

    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Article with this title already exists' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Failed to create knowledge base article' }, { status: 500 })
  }
}