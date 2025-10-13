/**
 * Email Department Classification with AI + Keyword Fallback
 *
 * Classifies inbound emails to departments (IT, HR, FIN, etc.) using:
 * 1. GPT-4o-mini AI classification
 * 2. Keyword matching fallback
 * 3. UNCLASSIFIED for low confidence
 *
 * Also generates relevant tags for ticket organization.
 */

import OpenAI from 'openai';
import { PrismaClient } from '@/lib/generated/prisma';

const prisma = new PrismaClient();

let openai: OpenAI | null = null;
function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

const MIN_CONFIDENCE = parseFloat(process.env.CLASSIFY_MIN_CONFIDENCE || '0.7');
const AI_TIMEOUT_MS = parseInt(process.env.AI_CLASSIFICATION_TIMEOUT_MS || '10000', 10);

// Keyword mapping for fallback
const DEPARTMENT_KEYWORDS: Record<string, string[]> = {
  'IT': [
    'printer', 'computer', 'laptop', 'desktop', 'password', 'email', 'outlook',
    'software', 'hardware', 'network', 'wifi', 'internet', 'vpn', 'login',
    'microsoft', 'windows', 'mac', 'iphone', 'android', 'phone', 'tablet',
    'excel', 'word', 'powerpoint', 'teams', 'zoom', 'slack', 'access',
    'server', 'database', 'backup', 'virus', 'malware', 'security', 'firewall'
  ],
  'HR': [
    'benefits', 'payroll', 'pto', 'vacation', 'sick leave', 'time off',
    'onboarding', 'offboarding', 'termination', 'resignation', 'retirement',
    'health insurance', 'dental', 'vision', '401k', 'fmla', 'ada',
    'harassment', 'discrimination', 'complaint', 'grievance', 'policy',
    'handbook', 'w2', 'w4', 'i9', 'direct deposit', 'paycheck'
  ],
  'FIN': [
    'invoice', 'payment', 'billing', 'expense', 'reimbursement', 'accounting',
    'budget', 'ledger', 'receipt', 'quickbooks', 'xero', 'sage', 'ap', 'ar',
    'accounts payable', 'accounts receivable', 'tax', 'audit', 'reconciliation',
    'purchase order', 'po', 'vendor', 'credit card', 'bank', 'wire transfer'
  ],
  'MKT': [
    'campaign', 'marketing', 'advertising', 'promotion', 'social media',
    'facebook', 'instagram', 'twitter', 'linkedin', 'website', 'seo', 'sem',
    'google ads', 'analytics', 'email campaign', 'newsletter', 'blog', 'content',
    'branding', 'logo', 'design', 'graphics', 'video', 'photography'
  ],
  'BRK': [
    'mls', 'listing', 'commission', 'escrow', 'closing', 'transaction', 'contract',
    'buyer', 'seller', 'agent', 'broker', 'property', 'real estate', 'showing',
    'offer', 'counteroffer', 'inspection', 'appraisal', 'title', 'deed'
  ],
  'OPS': [
    'facility', 'maintenance', 'repair', 'hvac', 'plumbing', 'electrical',
    'cleaning', 'janitorial', 'supplies', 'inventory', 'shipping', 'receiving',
    'warehouse', 'logistics', 'fleet', 'vehicle', 'keys', 'access card'
  ],
  'LEG': [
    'legal', 'attorney', 'lawyer', 'contract review', 'compliance', 'regulation',
    'lawsuit', 'litigation', 'nda', 'confidentiality', 'intellectual property',
    'trademark', 'copyright', 'patent', 'dispute', 'arbitration'
  ]
};

interface ClassificationResult {
  departmentCode: string; // IT, HR, FIN, MKT, BRK, OPS, LEG, GN (General/UNCLASSIFIED)
  tags: string[];         // kebab-case tags
  confidence: number;     // 0-1
  reasoning: string;      // Explanation
  method: 'ai' | 'keyword' | 'fallback';
}

/**
 * Classify email to department and generate tags
 */
export async function classifyDepartmentAndTags(params: {
  subject: string;
  text: string;
  html: string;
  from: string;
  to: string;
}): Promise<ClassificationResult> {
  // Try AI classification first
  try {
    const aiResult = await classifyWithAI(params);

    if (aiResult && aiResult.confidence >= MIN_CONFIDENCE) {
      return {
        ...aiResult,
        method: 'ai'
      };
    }

    console.log(`AI confidence too low: ${aiResult?.confidence}, falling back to keywords`);
  } catch (error) {
    console.error('AI classification failed:', error);
  }

  // Fallback to keyword matching
  const keywordResult = await classifyWithKeywords(params);

  if (keywordResult.confidence >= 0.5) {
    return {
      ...keywordResult,
      method: 'keyword'
    };
  }

  // Final fallback: UNCLASSIFIED
  return {
    departmentCode: 'GN',
    tags: ['uncategorized'],
    confidence: 0.1,
    reasoning: 'Could not determine department with confidence',
    method: 'fallback'
  };
}

/**
 * AI-powered classification with GPT-4o-mini
 */
async function classifyWithAI(params: {
  subject: string;
  text: string;
  from: string;
}): Promise<ClassificationResult | null> {
  const client = getOpenAI();
  if (!client) {
    console.warn('OpenAI not initialized (missing API key)');
    return null;
  }

  const prompt = `Classify this support email into a department and suggest relevant tags.

EMAIL FROM: ${params.from}
SUBJECT: ${params.subject}
BODY:
${params.text.substring(0, 1000)}

DEPARTMENTS:
- IT: Technology, computers, software, hardware, passwords, network
- HR: Payroll, benefits, time off, onboarding, policies
- FIN: Invoices, payments, expenses, accounting, budgets
- MKT: Marketing campaigns, social media, advertising, design
- BRK: Real estate brokerage, MLS, listings, commissions, transactions
- OPS: Operations, facilities, maintenance, supplies, logistics
- LEG: Legal matters, contracts, compliance, regulations
- GN: General inquiries that don't fit other departments

INSTRUCTIONS:
1. Determine the most appropriate department
2. Provide 3-5 relevant tags (lowercase, hyphenated)
3. Rate your confidence (0.0 to 1.0)
4. Explain your reasoning briefly

Respond with JSON only:
{
  "department": "IT",
  "tags": ["printer", "hardware", "urgent"],
  "confidence": 0.85,
  "reasoning": "User reporting printer hardware issue"
}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an expert email classifier for helpdesk tickets. Respond only with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 300
    }, {
      signal: controller.signal
    });

    clearTimeout(timeout);

    const result = JSON.parse(completion.choices[0].message.content || '{}');

    // Validate and normalize
    const departmentCode = mapDepartmentToCode(result.department);
    const tags = Array.isArray(result.tags)
      ? result.tags.map((t: string) => normalizeTag(t)).slice(0, 5)
      : ['general'];
    const confidence = Math.max(0, Math.min(1, result.confidence || 0.5));

    return {
      departmentCode,
      tags,
      confidence,
      reasoning: result.reasoning || 'AI classification completed',
      method: 'ai' as const
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error('AI classification timeout');
    } else {
      console.error('AI classification error:', error);
    }
    return null;
  }
}

/**
 * Keyword-based classification fallback
 */
async function classifyWithKeywords(params: {
  subject: string;
  text: string;
}): Promise<ClassificationResult> {
  const content = `${params.subject} ${params.text}`.toLowerCase();

  // Score each department by keyword matches
  const scores: Record<string, number> = {};

  for (const [dept, keywords] of Object.entries(DEPARTMENT_KEYWORDS)) {
    let score = 0;
    const matchedKeywords: string[] = [];

    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = content.match(regex);
      if (matches) {
        score += matches.length;
        matchedKeywords.push(keyword);
      }
    }

    scores[dept] = score;
  }

  // Get best match
  const best = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])[0];

  if (!best || best[1] === 0) {
    return {
      departmentCode: 'GN',
      tags: ['uncategorized'],
      confidence: 0.1,
      reasoning: 'No keyword matches found',
      method: 'fallback' as const
    };
  }

  const [department, score] = best;
  const confidence = Math.min(0.8, score / 10); // Cap at 0.8 for keyword matching

  // Generate tags from matched keywords
  const tags = DEPARTMENT_KEYWORDS[department]
    .filter(kw => content.includes(kw.toLowerCase()))
    .slice(0, 5)
    .map(normalizeTag);

  return {
    departmentCode: department,
    tags: tags.length > 0 ? tags : ['general'],
    confidence,
    reasoning: `Keyword matching: ${score} matches in ${department}`,
    method: 'keyword' as const
  };
}

/**
 * Map department name to code
 */
function mapDepartmentToCode(department: string): string {
  const normalized = department.toUpperCase().trim();

  const mapping: Record<string, string> = {
    'IT': 'IT',
    'INFORMATION TECHNOLOGY': 'IT',
    'TECH': 'IT',
    'HR': 'HR',
    'HUMAN RESOURCES': 'HR',
    'FIN': 'FIN',
    'FINANCE': 'FIN',
    'ACCOUNTING': 'FIN',
    'MKT': 'MKT',
    'MARKETING': 'MKT',
    'BRK': 'BRK',
    'BROKERAGE': 'BRK',
    'REAL ESTATE': 'BRK',
    'OPS': 'OPS',
    'OPERATIONS': 'OPS',
    'LEG': 'LEG',
    'LEGAL': 'LEG',
    'GN': 'GN',
    'GENERAL': 'GN'
  };

  return mapping[normalized] || 'GN';
}

/**
 * Normalize tag to kebab-case
 */
function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30);
}

/**
 * Get or create tags in database
 */
export async function getOrCreateTags(tagNames: string[]): Promise<string[]> {
  const tagIds: string[] = [];

  for (const name of tagNames) {
    const normalized = normalizeTag(name);
    if (!normalized) continue;

    // Find or create tag
    let tag = await prisma.tag.findUnique({
      where: { name: normalized }
    });

    if (!tag) {
      tag = await prisma.tag.create({
        data: {
          name: normalized,
          displayName: name,
          isActive: true,
          usageCount: 0
        }
      });
    }

    tagIds.push(tag.id);
  }

  return tagIds;
}

/**
 * Apply tags to ticket
 */
export async function applyTagsToTicket(
  ticketId: string,
  tagNames: string[],
  addedBy?: string
): Promise<void> {
  const tagIds = await getOrCreateTags(tagNames);

  for (const tagId of tagIds) {
    // Create ticket-tag relationship (skip if exists)
    await prisma.ticketTag.upsert({
      where: {
        ticketId_tagId: {
          ticketId,
          tagId
        }
      },
      create: {
        ticketId,
        tagId,
        addedBy
      },
      update: {}
    });

    // Increment usage count
    await prisma.tag.update({
      where: { id: tagId },
      data: {
        usageCount: {
          increment: 1
        }
      }
    });
  }
}
