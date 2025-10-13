/**
 * Script to fix tickets that don't have departmentId set
 * This will assign departmentId based on ticket number prefix
 */

import { prisma } from '../lib/prisma.js'

async function fixTicketDepartments() {
  try {
    console.log('🔍 Finding tickets without departmentId...')

    // Get all tickets without departmentId
    const ticketsWithoutDept = await prisma.ticket.findMany({
      where: {
        departmentId: null
      },
      select: {
        id: true,
        ticketNumber: true,
        status: true
      }
    })

    console.log(`Found ${ticketsWithoutDept.length} tickets without departmentId`)

    if (ticketsWithoutDept.length === 0) {
      console.log('✅ All tickets have departmentId assigned!')
      return
    }

    // Get all departments
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true
      }
    })

    console.log('\n📋 Available departments:')
    departments.forEach(d => console.log(`  - ${d.name} (${d.id})`))

    // Create a mapping of prefixes to department IDs
    const prefixMap = {}
    departments.forEach(dept => {
      const prefix = dept.name.replace(/\s+/g, '').substring(0, 2).toUpperCase()
      prefixMap[prefix] = dept.id
      console.log(`  Mapping: ${prefix} -> ${dept.name}`)
    })

    console.log('\n🔧 Fixing tickets...')
    let fixed = 0
    let notFixed = []

    for (const ticket of ticketsWithoutDept) {
      // Extract prefix from ticket number (e.g., "IT" from "IT000070")
      const match = ticket.ticketNumber.match(/^([A-Z]{2})/)

      if (match) {
        const prefix = match[1]
        const departmentId = prefixMap[prefix]

        if (departmentId) {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: { departmentId }
          })
          console.log(`  ✅ Fixed ${ticket.ticketNumber} -> ${prefix} department`)
          fixed++
        } else {
          notFixed.push({ ticket: ticket.ticketNumber, prefix, reason: 'No matching department' })
          console.log(`  ⚠️  ${ticket.ticketNumber}: No department found for prefix "${prefix}"`)
        }
      } else {
        notFixed.push({ ticket: ticket.ticketNumber, reason: 'No prefix found' })
        console.log(`  ⚠️  ${ticket.ticketNumber}: Could not extract prefix`)
      }
    }

    console.log(`\n✅ Fixed ${fixed} tickets`)
    if (notFixed.length > 0) {
      console.log(`⚠️  Could not fix ${notFixed.length} tickets:`)
      notFixed.forEach(item => {
        console.log(`  - ${item.ticket}: ${item.reason}`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixTicketDepartments()
