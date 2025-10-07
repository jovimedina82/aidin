#!/usr/bin/env node

/**
 * Test script to create a ticket and verify AI response is generated
 */

async function testAIResponse() {
  try {
    console.log('🧪 Testing AI Auto-Reply System...\n');

    // Create a test ticket
    console.log('1️⃣ Creating test ticket...');
    const createResponse = await fetch('http://localhost:3011/api/tickets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('admin@surterreproperties.com:Admin123!').toString('base64')
      },
      body: JSON.stringify({
        title: 'Test AI Response - Printer not working',
        description: 'My office printer is showing an error message and won\'t print documents. The error says "Paper Jam" but I don\'t see any jammed paper.',
        priority: 'NORMAL',
        requesterEmail: 'test.user@surterreproperties.com'
      })
    });

    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Failed to create ticket: ${error}`);
    }

    const ticket = await createResponse.json();
    console.log(`✅ Ticket created: ${ticket.ticketNumber} (ID: ${ticket.id})`);
    console.log(`   Title: ${ticket.title}`);
    console.log(`   Status: ${ticket.status}\n`);

    // Wait for AI response to be generated (background process)
    console.log('2️⃣ Waiting for AI response generation (10 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Fetch ticket with comments
    console.log('3️⃣ Checking for AI comment...');
    const ticketResponse = await fetch(`http://localhost:3011/api/tickets/${ticket.id}`, {
      headers: {
        'Authorization': 'Basic ' + Buffer.from('admin@surterreproperties.com:Admin123!').toString('base64')
      }
    });

    if (!ticketResponse.ok) {
      throw new Error('Failed to fetch ticket');
    }

    const ticketData = await ticketResponse.json();
    const aiComment = ticketData.comments?.find(c => c.user?.email === 'ai-assistant@surterre.local');

    if (aiComment) {
      console.log('✅ AI Comment found!');
      console.log(`   From: ${aiComment.user.firstName} ${aiComment.user.lastName}`);
      console.log(`   Posted: ${new Date(aiComment.createdAt).toLocaleString()}`);
      console.log(`\n   Content Preview:`);
      console.log(`   ${aiComment.content.substring(0, 200)}...\n`);
      console.log('✅ TEST PASSED: AI auto-reply is working!\n');
    } else {
      console.log('❌ No AI comment found');
      console.log(`   Total comments: ${ticketData.comments?.length || 0}`);
      if (ticketData.comments?.length > 0) {
        console.log('   Comments from:');
        ticketData.comments.forEach(c => {
          console.log(`   - ${c.user?.email || 'unknown'}`);
        });
      }
      console.log('\n❌ TEST FAILED: AI response not generated\n');
    }

    console.log(`📊 Ticket URL: http://localhost:3011/tickets/${ticket.id}`);

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    process.exit(1);
  }
}

testAIResponse();
