#!/usr/bin/env node

/**
 * Send a test vendor email to helpdesk@surterreproperties.com
 * This simulates a vendor inquiry to test the workflow
 */

import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.office365.com',
  port: 587,
  secure: false,
  requireTLS: true,
  auth: {
    user: 'helpdesk@surterreproperties.com',
    pass: '0N,V1,wb2qjIOCtIR(3g'
  }
});

const mailOptions = {
  from: '"Test Vendor - ABC Supplies" <testvendor@example.com>',
  to: 'helpdesk@surterreproperties.com',
  replyTo: 'john.smith@abcofficesupplies.com',
  subject: 'Vendor Inquiry: Office Supplies Quote Request',
  text: `Hello,

I am reaching out from ABC Office Supplies Inc. regarding our product catalog and pricing options for your company.

We specialize in:
- Office furniture and ergonomic chairs
- Stationery and office supplies
- Commercial printing services
- Technology accessories and cables
- Breakroom supplies

I would like to schedule a meeting to discuss how we can support your business needs and provide competitive pricing. Please let me know a convenient time for a brief 15-minute call.

We are also offering a 15% discount for new customers this month, plus free delivery on orders over $500. Our latest catalog and price list can be provided upon request.

Key Benefits of Working With Us:
✓ Same-day delivery in your area
✓ Dedicated account manager
✓ Volume discounts available
✓ Net-30 payment terms

Looking forward to hearing from you and discussing how we can serve your office supply needs.

Best regards,

John Smith
Senior Sales Representative
ABC Office Supplies Inc.
Phone: (555) 123-4567
Email: john.smith@abcofficesupplies.com
Website: www.abcofficesupplies.com

---
This is a test email sent to verify the vendor classification workflow.`,

  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <p>Hello,</p>

      <p>I am reaching out from <strong>ABC Office Supplies Inc.</strong> regarding our product catalog and pricing options for your company.</p>

      <p>We specialize in:</p>
      <ul>
        <li>Office furniture and ergonomic chairs</li>
        <li>Stationery and office supplies</li>
        <li>Commercial printing services</li>
        <li>Technology accessories and cables</li>
        <li>Breakroom supplies</li>
      </ul>

      <p>I would like to schedule a meeting to discuss how we can support your business needs and provide competitive pricing. Please let me know a convenient time for a brief 15-minute call.</p>

      <p>We are also offering a <strong>15% discount</strong> for new customers this month, plus <strong>free delivery</strong> on orders over $500. Our latest catalog and price list can be provided upon request.</p>

      <h3>Key Benefits of Working With Us:</h3>
      <ul>
        <li>✓ Same-day delivery in your area</li>
        <li>✓ Dedicated account manager</li>
        <li>✓ Volume discounts available</li>
        <li>✓ Net-30 payment terms</li>
      </ul>

      <p>Looking forward to hearing from you and discussing how we can serve your office supply needs.</p>

      <p>Best regards,</p>

      <p><strong>John Smith</strong><br>
      Senior Sales Representative<br>
      ABC Office Supplies Inc.<br>
      Phone: (555) 123-4567<br>
      Email: john.smith@abcofficesupplies.com<br>
      Website: www.abcofficesupplies.com</p>

      <hr style="border: none; border-top: 1px solid #ccc; margin: 20px 0;">
      <p style="font-size: 0.9em; color: #666;"><em>This is a test email sent to verify the vendor classification workflow.</em></p>
    </div>
  `
};

console.log('📧 Sending test vendor email to helpdesk@surterreproperties.com...\n');

transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error('❌ Error sending email:', error.message);
    process.exit(1);
  }

  console.log('✅ Test vendor email sent successfully!\n');
  console.log('📋 Email details:');
  console.log('   From: Test Vendor - ABC Supplies <testvendor@example.com>');
  console.log('   To: helpdesk@surterreproperties.com');
  console.log('   Subject: Vendor Inquiry: Office Supplies Quote Request');
  console.log('   Message ID:', info.messageId);
  console.log('\n🔍 Check your n8n workflow executions at:');
  console.log('   https://n8n.surterreproperties.com\n');
  console.log('The workflow should:');
  console.log('   1. Read the email from inbox');
  console.log('   2. Classify it as "vendor" using AI');
  console.log('   3. Forward it to the appropriate person (non-support)');
  console.log('   4. Mark the email as read');
  console.log('   5. NOT create a helpdesk ticket\n');
});
