# Automatic Knowledge Base Article Creation

## Overview
The system now automatically creates knowledge base articles when staff send AI-generated draft responses to tickets. This enriches the knowledge base with real-world solutions without requiring manual intervention.

## How It Works

### When Staff Send a Draft Response:
1. **Response is Posted**: The edited draft is posted as a comment on the ticket
2. **Email is Sent**: If the ticket came from email, a formatted HTML email is sent to the requester
3. **KB Article Created** (in background): 
   - System analyzes any images using OpenAI Vision API
   - AI transforms the response into a generic, reusable article
   - Article is saved to knowledge base
   - Ticket is linked to the new article

### Image Analysis:
If the draft contains screenshots or images:
- Each image is read with GPT-4o Vision API
- AI describes UI elements, error messages, settings, etc.
- Image insights are integrated into the KB article

### AI Enhancement:
The AI:
- Removes specific names, dates, and ticket numbers
- Structures content with proper markdown headings
- Converts ticket-specific responses into generic solutions
- Integrates image descriptions naturally
- Improves the title for better searchability

## Implementation Details

### Modified Files:
- `/opt/apps/aidin/app/api/tickets/[id]/send-draft/route.js`
  - Added OpenAI integration
  - Added image analysis functions
  - Added `createKBArticleFromDraft()` function
  - Triggers background KB creation after sending response

### Database:
- New KB articles are created in `knowledge_base` table
- Tickets are linked via `ticket_kb_usage` table with `usedInResponse = true`

### Console Logs:
When a KB article is created, you'll see:
```
✅ Auto-created KB article from ticket IT000048: <kb-id> - "Article Title" with 2 image(s) analyzed
```

## Benefits

1. **Zero Manual Effort**: Staff just send responses normally, KB grows automatically
2. **Rich Content**: Images are analyzed and described to add value
3. **Better Future Responses**: AI can use these articles for similar tickets
4. **Continuous Improvement**: Knowledge base grows with every resolved ticket
5. **No Blocking**: KB creation happens in background, doesn't slow down responses

## Manual Save to KB

The "Save to KB" button is still available for:
- Creating KB articles without sending the response
- Having more control over title and tags
- Creating articles from heavily customized responses

Both methods use the same AI enhancement and image analysis.
