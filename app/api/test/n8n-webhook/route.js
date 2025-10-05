import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Test the N8N webhook endpoint
    const testPayload = {
      event: 'ticket.created',
      timestamp: new Date().toISOString(),
      data: {
        id: 'test-123',
        ticketNumber: 'TEST-001',
        title: 'Test Ticket for N8N Integration',
        description: 'This is a test ticket to verify N8N webhook integration is working properly.',
        status: 'NEW',
        priority: 'HIGH',
        category: 'Password Issues',
        requesterId: 'test-user-id',
        assigneeId: null,
        departmentId: 'test-dept-id',
        createdAt: new Date().toISOString()
      }
    }

    // Send test webhook to N8N
    const response = await fetch('http://localhost:5678/webhook/new-ticket', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    })

    if (response.ok) {
      const responseData = await response.text()
      return NextResponse.json({
        success: true,
        message: 'N8N webhook test successful',
        n8nResponse: responseData,
        testPayload: testPayload
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'N8N webhook test failed',
        status: response.status,
        statusText: response.statusText
      }, { status: 400 })
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: 'N8N webhook test failed with error',
      error: error.message,
      hint: 'Make sure N8N is running and the workflow is active'
    }, { status: 500 })
  }
}