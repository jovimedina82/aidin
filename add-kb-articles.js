import { PrismaClient } from './lib/generated/prisma/index.js'

const prisma = new PrismaClient()

async function addKBArticles() {
  try {
    // Get IT department ID
    const itDept = await prisma.department.findUnique({
      where: { name: 'IT' }
    })

    const accountingDept = await prisma.department.findUnique({
      where: { name: 'Accounting' }
    })

    const hrDept = await prisma.department.findUnique({
      where: { name: 'HR' }
    })

    console.log('Departments found:', {
      IT: itDept?.id,
      Accounting: accountingDept?.id,
      HR: hrDept?.id
    })

    const articles = [
      {
        title: 'Password Reset Procedure',
        content: `To reset your password:
1. Go to the login page and click "Forgot Password"
2. Enter your email address
3. Check your email for a reset link
4. Click the link and create a new password
5. Your password must be at least 8 characters with uppercase, lowercase, and a number

If you don't receive the email within 5 minutes, check your spam folder.`,
        tags: JSON.stringify(['password', 'reset', 'login', 'security']),
        departmentId: itDept?.id
      },
      {
        title: 'Printer Troubleshooting',
        content: `Common printer problems:

1. Printer not found - Restart printer and check network connection
2. Print jobs stuck - Clear print queue and restart print spooler
3. Poor quality - Check ink levels and run cleaning cycle

Contact IT if problems persist.`,
        tags: JSON.stringify(['printer', 'printing', 'hardware']),
        departmentId: itDept?.id
      },
      {
        title: 'Invoice Processing',
        content: `Invoice processing steps:

1. Verify vendor information and amounts
2. Code with correct GL accounts
3. Enter in accounting system
4. Route for approval
5. File approved invoices

Contact Accounting for GL code questions.`,
        tags: JSON.stringify(['invoice', 'accounting', 'procedure']),
        departmentId: accountingDept?.id
      }
    ]

    for (const article of articles) {
      if (article.departmentId) {
        const created = await prisma.knowledgeBase.create({
          data: article
        })
        console.log(`✅ Created: ${created.title}`)
      }
    }

    console.log('✅ Knowledge base articles added successfully!')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addKBArticles()