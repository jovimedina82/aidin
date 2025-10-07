import { sendEmail } from '../lib/email.js';

console.log('📧 Sending test vendor email...\n');

const emailContent = {
  to: 'helpdesk@surterreproperties.com',
  from: '"Test Vendor - ABC Supplies" <helpdesk@surterreproperties.com>',
  replyTo: 'john.smith@abcofficesupplies.com',
  subject: 'Vendor Inquiry: Office Supplies Quote Request',
  html: `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
      <p>Hello,</p>

      <p>I am reaching out from <strong>ABC Office Supplies Inc.</strong> regarding our product catalog and pricing options for your company.</p>

      <p>We specialize in:</p>
      <ul>
        <li>Office furniture and ergonomic chairs</li>
        <li>Stationery and office supplies</li>
        <li>Commercial printing services</li>
        <li>Technology accessories</li>
      </ul>

      <p>I would like to schedule a meeting to discuss pricing and product offerings. We're offering <strong>15% discount for new customers</strong> this month.</p>

      <p>Key Benefits:</p>
      <ul>
        <li>✓ Same-day delivery</li>
        <li>✓ Dedicated account manager</li>
        <li>✓ Volume discounts</li>
        <li>✓ Net-30 payment terms</li>
      </ul>

      <p>Looking forward to hearing from you.</p>

      <p><strong>John Smith</strong><br>
      Sales Representative<br>
      ABC Office Supplies Inc.<br>
      Phone: (555) 123-4567<br>
      Email: john.smith@abcofficesupplies.com</p>

      <hr style="margin: 20px 0;">
      <p style="font-size: 0.9em; color: #666;"><em>Test email for vendor classification workflow</em></p>
    </div>
  `
};

try {
  await sendEmail(emailContent);
  console.log('✅ Test vendor email sent successfully!\n');
  console.log('📋 The email will arrive in helpdesk@surterreproperties.com\n');
  console.log('🔍 Monitor the workflow at: https://n8n.surterreproperties.com\n');
  console.log('Expected behavior:');
  console.log('   1. Email appears in inbox');
  console.log('   2. AI classifies as "vendor"');
  console.log('   3. Email gets forwarded (not converted to ticket)');
  console.log('   4. Email marked as read\n');
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
