import { NextResponse } from 'next/server'
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { generateEmbedding } from '../../../../../lib/ai/knowledge-search.js'


export async function PUT(request, { params }) {
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

    // Generate new embedding for the updated article
    const text = `${title}\n\n${content}`
    const embedding = await generateEmbedding(text)

    // Update knowledge base article
    const updatedArticle = await prisma.knowledgeBase.update({
      where: { id: params.id },
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
        },
        ticketResponses: {
          select: {
            id: true,
            usedInResponse: true,
            relevance: true
          }
        }
      }
    })

    return NextResponse.json({
      ...updatedArticle,
      tags: updatedArticle.tags ? JSON.parse(updatedArticle.tags) : [],
      hasEmbedding: !!updatedArticle.embedding,
      totalUsage: updatedArticle.ticketResponses.length,
      responseUsage: updatedArticle.ticketResponses.filter(tr => tr.usedInResponse).length
    })

  } catch (error) {
    console.error('Error updating knowledge base article:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Article with this title already exists' }, { status: 400 })
    }

    return NextResponse.json({ error: 'Failed to update knowledge base article' }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
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

    // Delete knowledge base article
    await prisma.knowledgeBase.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ message: 'Knowledge base article deleted successfully' })

  } catch (error) {
    console.error('Error deleting knowledge base article:', error)

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    return NextResponse.json({ error: 'Failed to delete knowledge base article' }, { status: 500 })
  }
}