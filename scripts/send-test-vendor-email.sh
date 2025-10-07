#!/bin/bash

# Send a test vendor email to helpdesk@surterreproperties.com
# This simulates a vendor inquiry to test the workflow

echo "📧 Sending test vendor email to helpdesk@surterreproperties.com..."
echo ""

# Using the SMTP configuration from .env
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_USER="helpdesk@surterreproperties.com"
SMTP_PASS="0N,V1,wb2qjIOCtIR(3g"
FROM_EMAIL="testvendor@example.com"
TO_EMAIL="helpdesk@surterreproperties.com"
SUBJECT="Vendor Inquiry: Office Supplies Quote Request"

# Email body that should be classified as vendor
BODY="Hello,

I am reaching out from ABC Office Supplies Inc. regarding our product catalog and pricing options for your company.

We specialize in:
- Office furniture
- Stationery and supplies
- Printing services
- Technology accessories

I would like to schedule a meeting to discuss how we can support your business needs. Please let me know a convenient time for you.

We are also offering a 15% discount for new customers this month. Our latest catalog is attached (simulated).

Looking forward to hearing from you.

Best regards,
John Smith
Sales Representative
ABC Office Supplies Inc.
Phone: (555) 123-4567
Email: john.smith@abcofficesupplies.com
Website: www.abcofficesupplies.com"

# Create email message
EMAIL_MSG="From: Test Vendor <${FROM_EMAIL}>
To: ${TO_EMAIL}
Subject: ${SUBJECT}
Content-Type: text/plain; charset=UTF-8

${BODY}"

# Send email using swaks (if available) or curl
if command -v swaks &> /dev/null; then
    echo "Using swaks to send email..."
    echo "$EMAIL_MSG" | swaks \
        --to "$TO_EMAIL" \
        --from "$FROM_EMAIL" \
        --server "$SMTP_HOST:$SMTP_PORT" \
        --auth LOGIN \
        --auth-user "$SMTP_USER" \
        --auth-password "$SMTP_PASS" \
        --tls \
        --header "Subject: $SUBJECT" \
        --body "$BODY"
else
    echo "swaks not found. Using curl with SMTP..."

    # Create temporary file for email
    TEMP_FILE=$(mktemp)
    echo "$EMAIL_MSG" > "$TEMP_FILE"

    # Send via curl
    curl --url "smtp://${SMTP_HOST}:${SMTP_PORT}" \
        --mail-from "$FROM_EMAIL" \
        --mail-rcpt "$TO_EMAIL" \
        --upload-file "$TEMP_FILE" \
        --user "${SMTP_USER}:${SMTP_PASS}" \
        --ssl-reqd \
        -v

    rm -f "$TEMP_FILE"
fi

echo ""
echo "✅ Test vendor email sent!"
echo ""
echo "📋 Email details:"
echo "   From: Test Vendor <${FROM_EMAIL}>"
echo "   To: ${TO_EMAIL}"
echo "   Subject: ${SUBJECT}"
echo ""
echo "🔍 Check your n8n workflow executions at:"
echo "   https://n8n.surterreproperties.com"
echo ""
echo "The workflow should:"
echo "   1. Read the email"
echo "   2. Classify it as 'vendor' using AI"
echo "   3. Forward it to the appropriate person"
echo "   4. Mark the email as read"
