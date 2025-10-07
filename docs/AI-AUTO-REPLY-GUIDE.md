# 🤖 AI Auto-Reply System Guide

## Overview

The helpdesk system now features an **enhanced AI auto-reply system** that automatically responds to tickets when they're created. The system has been upgraded with:

- ✅ **GPT-4o (GPT-4 Optimized)** - Most advanced and accurate AI model
- ✅ **Knowledge Base Search** - Searches internal KB for relevant solutions first
- ✅ **Web Search Capability** - Falls back to internet search when KB has no relevant articles
- ✅ **Automatic Email Reply** - Sends AI response via email for email-created tickets
- ✅ **First Response Priority** - AI responds immediately as the first comment on every new ticket

---

## How It Works

### Step-by-Step Flow:

```
1. New ticket created (via email, web form, or API)
   ↓
2. Ticket saved to database
   ↓
3. AI Auto-Reply triggers (background process)
   ↓
4. Search Knowledge Base for relevant articles
   ↓
5a. KB articles found?
    YES → Generate response using KB articles + GPT-4o
    NO  → Use GPT-4o with web search to find solutions
   ↓
6. Create AI comment on ticket (from ai-assistant@surterre.local)
   ↓
7. If ticket created from email:
    → Send AI response as email reply to requester
   ↓
8. Done! User receives instant, accurate response
```

---

## Architecture Details

### Knowledge Base Priority (When KB Articles Found)

**Model**: GPT-4o
**Max Tokens**: 500
**Temperature**: 0.7

**Process**:
1. Search KB using semantic similarity (embeddings)
2. Return top 3 most relevant articles (>0.3 similarity threshold)
3. Pass KB content to GPT-4o with ticket details
4. AI generates friendly, actionable response based on KB
5. Track KB usage for analytics

**System Prompt**:
```
You are Aiden, a knowledgeable IT support specialist.
You have access to a knowledge base and should use that
information to provide helpful, accurate solutions.
Always maintain a friendly, professional tone and provide
actionable advice.
```

### Web Search Fallback (When No KB Articles)

**Model**: GPT-4o
**Max Tokens**: 600
**Temperature**: 0.7

**Process**:
1. No relevant KB articles found
2. GPT-4o searches the internet for current solutions
3. Provides specific troubleshooting steps with sources
4. Includes links to official documentation when relevant

**System Prompt**:
```
You are Aiden, a knowledgeable IT support specialist with
access to current internet information. Use web search to
find accurate, up-to-date solutions. Provide helpful,
specific guidance with actionable steps. Always cite
sources when providing technical solutions.
```

---

## Configuration

### Current Settings

**Location**: `/opt/apps/aidin/lib/ai/response-generation.js`

```javascript
// Knowledge Base Response
model: "gpt-4o"
max_tokens: 500
temperature: 0.7

// General Response (with web search)
model: "gpt-4o"
max_tokens: 600
temperature: 0.7
```

### Environment Variables

```bash
# Required
OPENAI_API_KEY=sk-...  # Your OpenAI API key

# Optional (defaults shown)
ENABLE_LIVE_UPDATES=true  # Real-time updates via Socket.IO
```

---

## Email Integration

### Automatic Email Replies

When a ticket is created from email:

1. Ticket is created with `emailConversationId`
2. AI generates response (using GPT-4o + KB/web search)
3. AI comment is added to ticket
4. EmailService sends reply directly via Microsoft Graph API
5. Email reply sent to user's inbox (threaded in original conversation)
6. User receives AI response automatically (0-5 seconds)

**Email Format**:
```
[AI-generated response content]

---
Ticket: IT000123
AidIN Helpdesk System
```

---

## API Endpoints

### Trigger AI Reply Manually

**POST** `/api/tickets/send-ai-email`

```json
{
  "ticketId": "clx1234567890",
  "accessToken": "eyJ0eXAiOiJKV1Q..."
}
```

**Response**:
```json
{
  "success": true,
  "ticketNumber": "IT000123",
  "message": "AI response email sent successfully"
}
```

---

## Knowledge Base Search

### Semantic Search

The system uses **OpenAI text-embedding-ada-002** embeddings for semantic search:

1. Each KB article has an embedding vector (1536 dimensions)
2. Query is converted to embedding
3. Cosine similarity calculated between query and all KB articles
4. Top results ranked by similarity score
5. Minimum threshold: 0.3 (30% similarity)
6. Returns top 3 most relevant articles

### Update KB Embeddings

To generate embeddings for new KB articles:

```javascript
import { updateKnowledgeBaseEmbeddings } from './lib/ai/knowledge-search.js'

await updateKnowledgeBaseEmbeddings()
```

**Or** use the admin UI to create/update KB articles (embeddings generated automatically).

---

## Response Quality Examples

### Example 1: KB Article Found

**Ticket**: "Cannot access shared drive"

**AI Response**:
```
Hi John,

Thank you for reaching out about the shared drive access issue.
I can help you with that!

Based on our knowledge base, here are the steps to resolve this:

1. Right-click on "This PC" and select "Map Network Drive"
2. Choose drive letter Z:
3. Enter the path: \\surterre-dc\shared
4. Check "Reconnect at sign-in"
5. Use your network credentials when prompted

If you're still having trouble after following these steps,
please let me know and I'll escalate this to our network team.

Best regards,
Aiden
IT Support Specialist
```

### Example 2: No KB Article (Web Search)

**Ticket**: "Zoom audio echo during meetings"

**AI Response**:
```
Hi Maria,

I understand you're experiencing an audio echo during Zoom
meetings - that can be really frustrating. Let me help you
resolve this.

Here are the most effective troubleshooting steps based on
current best practices:

1. **Use Headphones**: This is the #1 fix. Audio echoes occur
   when your microphone picks up sound from your speakers.

2. **Check Speaker/Mic Settings in Zoom**:
   - Click Settings → Audio
   - Test your speaker and microphone
   - Enable "Automatically adjust volume"

3. **Mute When Not Speaking**: Ask other participants to do
   the same

4. **Update Zoom**: Ensure you're on the latest version
   - Current version: 5.17.0 (as of Jan 2025)

5. **Check for Multiple Audio Sources**: Close other apps
   using your microphone

Official Zoom troubleshooting guide:
https://support.zoom.us/hc/en-us/articles/202050538

Let me know if the issue persists after trying these steps!

Best regards,
Aiden
IT Support Specialist
```

---

## Monitoring & Analytics

### Track AI Response Performance

**Database Table**: `TicketComment`

Query AI responses:
```sql
SELECT
  tc.createdAt,
  t.ticketNumber,
  t.title,
  tc.content,
  t.emailConversationId IS NOT NULL as via_email
FROM TicketComment tc
JOIN Ticket t ON tc.ticketId = t.id
JOIN User u ON tc.userId = u.id
WHERE u.email = 'ai-assistant@surterre.local'
ORDER BY tc.createdAt DESC;
```

### Knowledge Base Usage Tracking

**Database Table**: `TicketKBUsage`

```sql
SELECT
  kb.title,
  COUNT(*) as times_used,
  AVG(tku.relevance) as avg_relevance,
  SUM(CASE WHEN tku.usedInResponse THEN 1 ELSE 0 END) as used_in_ai_responses
FROM TicketKBUsage tku
JOIN KnowledgeBase kb ON tku.kbId = kb.id
GROUP BY kb.id
ORDER BY times_used DESC;
```

---

## Cost Estimation

### OpenAI API Costs (GPT-4o)

**Pricing** (as of Jan 2025):
- Input: $2.50 / 1M tokens
- Output: $10.00 / 1M tokens

**Average Cost Per Ticket**:
- KB-based response: ~$0.01 - $0.02
- Web search response: ~$0.02 - $0.03
- Embedding generation (per KB article): ~$0.0001

**Example Monthly Cost** (100 tickets/day):
- 3,000 tickets/month
- Estimated: $30 - $60/month
- **ROI**: Saves ~30-60 hours of manual first responses

---

## Troubleshooting

### AI Responses Not Being Generated

**Check**:
1. OpenAI API key is valid: `.env` → `OPENAI_API_KEY`
2. AI assistant user exists in database:
   ```sql
   SELECT * FROM User WHERE email = 'ai-assistant@surterre.local';
   ```
3. Check server logs:
   ```bash
   npx pm2 logs aidin-helpdesk | grep -i "ai response"
   ```

### AI Responses Not Being Emailed

**Check**:
1. N8N is running on port 5678
2. Webhook endpoint exists: `http://localhost:5678/webhook/send-ai-response`
3. Microsoft Graph credentials configured in N8N
4. Check N8N execution logs

### Low Quality Responses

**Solutions**:
1. **Improve KB articles**: Add more detailed, accurate articles
2. **Update embeddings**: Run `updateKnowledgeBaseEmbeddings()`
3. **Adjust temperature**: Lower = more focused (0.5), Higher = more creative (0.9)
4. **Increase max_tokens**: Allow longer, more detailed responses

### KB Articles Not Being Found

**Check**:
1. Articles have embeddings generated:
   ```sql
   SELECT title, embedding IS NOT NULL as has_embedding
   FROM KnowledgeBase
   WHERE isActive = true;
   ```
2. Articles are active: `isActive = true`
3. Similarity threshold might be too high (increase from 0.3 to 0.5)

---

## Upgrade History

### v2.0 (January 2025) - Current

✅ Upgraded from GPT-3.5-turbo to **GPT-4o**
✅ Added web search capability for tickets without KB matches
✅ Increased max tokens (400 → 500 for KB, 300 → 600 for general)
✅ Enhanced system prompts for better responses
✅ Improved fallback response quality

### v1.0 (Original)

- GPT-3.5-turbo
- Knowledge Base search only
- Basic responses

---

## Best Practices

### 1. Maintain Quality KB Articles
- Keep articles up-to-date
- Include step-by-step instructions
- Add screenshots where helpful
- Use clear, simple language
- Tag articles properly

### 2. Monitor AI Response Quality
- Review AI responses weekly
- Collect user feedback
- Update KB based on frequently asked questions
- Refine prompts if responses are off-topic

### 3. Balance Automation & Human Touch
- AI provides first response (instant)
- Human agents follow up for complex issues
- Use AI suggestions but don't rely 100%
- Escalate when AI confidence is low

### 4. Cost Management
- Monitor OpenAI API usage
- Set billing alerts
- Cache common responses if needed
- Use KB articles to reduce API calls

---

## Future Enhancements

### Planned Features:
- [ ] Multi-language support (detect language, respond in same)
- [ ] Sentiment analysis (detect frustrated users, prioritize)
- [ ] Learning system (improve based on human corrections)
- [ ] Custom AI models fine-tuned on company data
- [ ] Voice/phone integration for AI responses
- [ ] Proactive ticket suggestions (before users ask)

---

## Support

### Need Help?

1. **Check logs**: `npx pm2 logs aidin-helpdesk`
2. **Test OpenAI connection**:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```
3. **Review this guide**: All common issues covered
4. **Contact**: IT team for advanced troubleshooting

---

## Summary

The AI auto-reply system is **now active** and using **GPT-4o** with:

✅ **Knowledge Base priority** - Searches internal KB first
✅ **Web search fallback** - Finds solutions online when KB empty
✅ **Automatic email replies** - Sends responses to email-created tickets
✅ **First response guarantee** - Every ticket gets instant AI response
✅ **Cost-effective** - ~$0.01-$0.03 per ticket, saves hours of manual work

**No configuration needed** - System is active and running automatically!
