import { PrismaClient } from './lib/generated/prisma/index.js'
import { updateKnowledgeBaseEmbeddings } from './lib/ai/knowledge-search.js'

const prisma = new PrismaClient()

async function setupAIFeatures() {
  console.log('🚀 Setting up AI features...')

  try {
    // 1. Create sample departments if they don't exist
    console.log('📁 Setting up departments...')

    const departments = [
      {
        name: 'IT',
        description: 'Information Technology support and services',
        color: 'blue'
      },
      {
        name: 'Accounting',
        description: 'Financial services and billing support',
        color: 'green'
      },
      {
        name: 'HR',
        description: 'Human Resources and employee services',
        color: 'purple'
      },
      {
        name: 'Sales',
        description: 'Sales support and customer relations',
        color: 'orange'
      }
    ]

    const createdDepartments = {}

    for (const dept of departments) {
      const existingDept = await prisma.department.findUnique({
        where: { name: dept.name }
      })

      if (!existingDept) {
        const newDept = await prisma.department.create({
          data: dept
        })
        createdDepartments[dept.name] = newDept.id
        console.log(`✅ Created department: ${dept.name}`)
      } else {
        createdDepartments[dept.name] = existingDept.id
        console.log(`📋 Department exists: ${dept.name}`)
      }
    }

    // 2. Setup department keywords
    console.log('🔤 Setting up department keywords...')

    const departmentKeywords = {
      'IT': [
        { keyword: 'computer', weight: 2.0 },
        { keyword: 'laptop', weight: 2.0 },
        { keyword: 'desktop', weight: 2.0 },
        { keyword: 'screen', weight: 1.5 },
        { keyword: 'monitor', weight: 1.5 },
        { keyword: 'keyboard', weight: 1.5 },
        { keyword: 'mouse', weight: 1.5 },
        { keyword: 'printer', weight: 1.8 },
        { keyword: 'internet', weight: 2.0 },
        { keyword: 'wifi', weight: 2.0 },
        { keyword: 'network', weight: 2.0 },
        { keyword: 'email', weight: 1.8 },
        { keyword: 'outlook', weight: 1.8 },
        { keyword: 'office 365', weight: 2.0 },
        { keyword: 'teams', weight: 1.5 },
        { keyword: 'sharepoint', weight: 1.5 },
        { keyword: 'onedrive', weight: 1.5 },
        { keyword: 'password', weight: 1.8 },
        { keyword: 'login', weight: 1.8 },
        { keyword: 'access', weight: 1.5 },
        { keyword: 'software', weight: 1.5 },
        { keyword: 'application', weight: 1.5 },
        { keyword: 'program', weight: 1.5 },
        { keyword: 'virus', weight: 2.5 },
        { keyword: 'malware', weight: 2.5 },
        { keyword: 'security', weight: 2.0 },
        { keyword: 'phishing', weight: 2.5 },
        { keyword: 'scam', weight: 2.5 },
        { keyword: 'vpn', weight: 1.8 },
        { keyword: 'server', weight: 1.8 }
      ],
      'Accounting': [
        { keyword: 'billing', weight: 2.5 },
        { keyword: 'invoice', weight: 2.5 },
        { keyword: 'payment', weight: 2.0 },
        { keyword: 'check', weight: 2.0 },
        { keyword: 'financial', weight: 1.8 },
        { keyword: 'accounting', weight: 2.0 },
        { keyword: 'expense', weight: 1.8 },
        { keyword: 'budget', weight: 1.8 },
        { keyword: 'quickbooks', weight: 2.0 },
        { keyword: 'payroll', weight: 2.0 },
        { keyword: 'tax', weight: 1.8 },
        { keyword: 'receipt', weight: 1.5 },
        { keyword: 'vendor', weight: 1.5 },
        { keyword: 'purchase order', weight: 1.8 },
        { keyword: 'ap', weight: 1.5 },
        { keyword: 'ar', weight: 1.5 }
      ],
      'HR': [
        { keyword: 'employee', weight: 2.0 },
        { keyword: 'hr', weight: 2.5 },
        { keyword: 'human resources', weight: 2.5 },
        { keyword: 'payroll', weight: 2.0 },
        { keyword: 'benefits', weight: 2.0 },
        { keyword: 'vacation', weight: 1.8 },
        { keyword: 'pto', weight: 1.8 },
        { keyword: 'sick leave', weight: 1.8 },
        { keyword: 'performance', weight: 1.5 },
        { keyword: 'training', weight: 1.8 },
        { keyword: 'onboarding', weight: 1.8 },
        { keyword: 'termination', weight: 1.8 },
        { keyword: 'policy', weight: 1.5 },
        { keyword: 'handbook', weight: 1.5 },
        { keyword: 'hris', weight: 2.0 }
      ],
      'Sales': [
        { keyword: 'customer', weight: 2.0 },
        { keyword: 'client', weight: 2.0 },
        { keyword: 'crm', weight: 2.5 },
        { keyword: 'salesforce', weight: 2.5 },
        { keyword: 'lead', weight: 1.8 },
        { keyword: 'prospect', weight: 1.8 },
        { keyword: 'opportunity', weight: 1.8 },
        { keyword: 'quote', weight: 1.8 },
        { keyword: 'proposal', weight: 1.8 },
        { keyword: 'contract', weight: 1.8 },
        { keyword: 'deal', weight: 1.5 },
        { keyword: 'pipeline', weight: 1.5 },
        { keyword: 'commission', weight: 1.8 },
        { keyword: 'territory', weight: 1.5 }
      ]
    }

    for (const [deptName, keywords] of Object.entries(departmentKeywords)) {
      const deptId = createdDepartments[deptName]
      if (deptId) {
        for (const { keyword, weight } of keywords) {
          try {
            await prisma.departmentKeyword.upsert({
              where: {
                departmentId_keyword: {
                  departmentId: deptId,
                  keyword: keyword
                }
              },
              update: { weight },
              create: {
                departmentId: deptId,
                keyword,
                weight
              }
            })
          } catch (error) {
            // Keyword might already exist, continue
            console.log(`⚠️ Keyword "${keyword}" already exists for ${deptName}`)
          }
        }
        console.log(`✅ Added keywords for ${deptName} department`)
      }
    }

    // 3. Create sample knowledge base articles
    console.log('📚 Setting up knowledge base...')

    const kbArticles = [
      {
        title: 'Password Reset Procedure',
        content: `To reset your password:
1. Go to the login page and click "Forgot Password"
2. Enter your email address
3. Check your email for a reset link
4. Click the link and create a new password
5. Your password must be at least 8 characters with uppercase, lowercase, and a number

If you don't receive the email within 5 minutes, check your spam folder. If you still need help, contact IT support.`,
        tags: JSON.stringify(['password', 'reset', 'login', 'security']),
        departmentId: createdDepartments['IT']
      },
      {
        title: 'Outlook Email Setup',
        content: `To set up Outlook:
1. Open Outlook and click "Add Account"
2. Enter your email address
3. Enter your password when prompted
4. Wait for automatic configuration
5. If automatic setup fails, use these manual settings:
   - Server: outlook.office365.com
   - Port: 993 (IMAP) or 995 (POP3)
   - Encryption: SSL

For mobile devices, download the Outlook app and use the same credentials.`,
        tags: JSON.stringify(['outlook', 'email', 'setup', 'configuration']),
        departmentId: createdDepartments['IT']
      },
      {
        title: 'Printer Connection Issues',
        content: `Common printer problems and solutions:

1. Printer not found:
   - Ensure printer is on and connected to network
   - Restart the printer
   - Check if computer is on same network

2. Print jobs stuck in queue:
   - Open printer queue and clear all jobs
   - Restart print spooler service
   - Restart printer

3. Poor print quality:
   - Check ink/toner levels
   - Run printer cleaning cycle
   - Check paper type settings

For persistent issues, contact IT support with the printer model and error message.`,
        tags: JSON.stringify(['printer', 'printing', 'hardware', 'troubleshooting']),
        departmentId: createdDepartments['IT']
      },
      {
        title: 'WiFi Connection Problems',
        content: `WiFi troubleshooting steps:

1. Check if WiFi is enabled on your device
2. Forget and reconnect to the network:
   - Windows: Settings > Network > WiFi > Manage known networks
   - Mac: System Preferences > Network > WiFi > Advanced
3. Restart your device
4. Check if other devices can connect
5. Move closer to the router
6. Restart the router if multiple devices affected

Network credentials:
- Network: SurterreWiFi
- Contact IT for password

If problems persist, check for interference from other devices.`,
        tags: JSON.stringify(['wifi', 'network', 'connection', 'internet']),
        departmentId: createdDepartments['IT']
      },
      {
        title: 'Invoice Processing Procedure',
        content: `To process invoices:

1. Verify invoice details:
   - Check vendor information
   - Confirm amounts and dates
   - Ensure proper authorization

2. Code the invoice:
   - Assign correct GL accounts
   - Add department codes
   - Include project numbers if applicable

3. Enter in accounting system:
   - Scan or photograph invoice
   - Input all relevant data
   - Attach supporting documents

4. Route for approval:
   - Send to department manager
   - Obtain required signatures
   - File approved invoices

For questions about GL codes or approval limits, contact the Accounting department.`,
        tags: JSON.stringify(['invoice', 'accounting', 'procedure', 'approval']),
        departmentId: createdDepartments['Accounting']
      },
      {
        title: 'Time Off Request Process',
        content: `To request time off:

1. Submit request at least 2 weeks in advance
2. Use the employee portal or submit form to HR
3. Include specific dates and reason
4. Wait for manager approval
5. HR will confirm approval and update records

Types of leave:
- Vacation: Accrued based on tenure
- Sick leave: For illness or medical appointments
- Personal days: Limited per year
- Bereavement: Up to 3 days for immediate family

Check your employee handbook for specific policies and accrual rates.`,
        tags: JSON.stringify(['pto', 'vacation', 'time off', 'hr', 'benefits']),
        departmentId: createdDepartments['HR']
      }
    ]

    for (const article of kbArticles) {
      try {
        await prisma.knowledgeBase.upsert({
          where: { title: article.title },
          update: article,
          create: article
        })
        console.log(`✅ Added KB article: ${article.title}`)
      } catch (error) {
        console.log(`⚠️ KB article "${article.title}" might already exist`)
      }
    }

    // 4. Generate embeddings for knowledge base
    console.log('🧠 Generating embeddings for knowledge base...')
    const embeddingResult = await updateKnowledgeBaseEmbeddings()
    console.log(`✅ Generated embeddings: ${embeddingResult.processed} processed, ${embeddingResult.errors} errors`)

    // 5. Update todo
    console.log('✅ AI features setup completed!')
    console.log('\n📋 What was set up:')
    console.log('- 4 departments with keyword dictionaries')
    console.log('- 6 knowledge base articles with embeddings')
    console.log('- Enhanced AI routing and categorization')
    console.log('- Knowledge base-driven response generation')

    console.log('\n🔧 To test the system:')
    console.log('1. Create a new ticket with keywords like "password reset" or "printer problem"')
    console.log('2. Check if it gets routed to the correct department')
    console.log('3. Review the AI-generated response based on knowledge base')
    console.log('4. View AI decision data in the database')

  } catch (error) {
    console.error('❌ Error setting up AI features:', error)
  } finally {
    await prisma.$disconnect()
  }
}

setupAIFeatures()