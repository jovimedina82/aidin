import OpenAI from 'openai'
import { PrismaClient } from '../generated/prisma/index.js'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const prisma = new PrismaClient()

export async function searchKnowledgeBase(query, departmentId = null, limit = 5) {
  try {
    // Get query embedding
    const queryEmbedding = await getEmbedding(query)

    // Get all active KB articles (optionally filtered by department)
    const whereClause = {
      isActive: true,
      embedding: { not: null }
    }

    if (departmentId) {
      whereClause.departmentId = departmentId
    }

    const kbArticles = await prisma.knowledgeBase.findMany({
      where: whereClause
    })

    if (kbArticles.length === 0) {
      return []
    }

    // Calculate similarity scores
    const scoredArticles = kbArticles.map(article => {
      const articleEmbedding = JSON.parse(article.embedding)
      const similarity = cosineSimilarity(queryEmbedding, articleEmbedding)

      return {
        id: article.id,
        title: article.title,
        content: article.content,
        tags: article.tags ? JSON.parse(article.tags) : [],
        similarity,
        usageCount: article.usageCount
      }
    })

    // Sort by similarity and return top results
    return scoredArticles
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
      .filter(article => article.similarity > 0.3) // Minimum similarity threshold

  } catch (error) {
    console.error('Error searching knowledge base:', error)
    return []
  }
}

export async function generateEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: text,
    })

    return response.data[0].embedding
  } catch (error) {
    console.error('Error generating embedding:', error)
    return null
  }
}

export async function getEmbedding(text) {
  return await generateEmbedding(text)
}

export async function updateKnowledgeBaseEmbeddings() {
  try {
    console.log('Starting knowledge base embedding update...')

    // Get all KB articles without embeddings or with outdated embeddings
    const articles = await prisma.knowledgeBase.findMany({
      where: {
        isActive: true,
        OR: [
          { embedding: null },
          { embedding: '' }
        ]
      }
    })

    console.log(`Found ${articles.length} articles to process`)

    let processed = 0
    let errors = 0

    for (const article of articles) {
      try {
        // Combine title and content for embedding
        const text = `${article.title}\n\n${article.content}`
        const embedding = await generateEmbedding(text)

        if (embedding) {
          await prisma.knowledgeBase.update({
            where: { id: article.id },
            data: { embedding: JSON.stringify(embedding) }
          })
          processed++
        } else {
          errors++
        }

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error) {
        console.error(`Error processing article ${article.id}:`, error)
        errors++
      }
    }

    console.log(`Embedding update complete. Processed: ${processed}, Errors: ${errors}`)
    return { processed, errors }

  } catch (error) {
    console.error('Error updating knowledge base embeddings:', error)
    return { processed: 0, errors: 1 }
  }
}

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i]
    normA += vecA[i] * vecA[i]
    normB += vecB[i] * vecB[i]
  }

  normA = Math.sqrt(normA)
  normB = Math.sqrt(normB)

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dotProduct / (normA * normB)
}

export async function recordKBUsage(ticketId, kbId, relevance, usedInResponse = false) {
  try {
    // Record the usage
    await prisma.ticketKBUsage.upsert({
      where: {
        ticketId_kbId: {
          ticketId,
          kbId
        }
      },
      update: {
        relevance,
        usedInResponse
      },
      create: {
        ticketId,
        kbId,
        relevance,
        usedInResponse
      }
    })

    // Increment usage count on the KB article
    if (usedInResponse) {
      await prisma.knowledgeBase.update({
        where: { id: kbId },
        data: {
          usageCount: {
            increment: 1
          }
        }
      })
    }

  } catch (error) {
    console.error('Error recording KB usage:', error)
  }
}