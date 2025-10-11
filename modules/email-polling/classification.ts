/**
 * Email Classification Service
 *
 * Classifies emails as support/vendor/unclear using AI and heuristics.
 * Assigns confidence scores and priority levels.
 *
 * @module modules/email-polling/classification
 */

import OpenAI from 'openai';

// Lazy initialization to avoid build errors
let openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  if (!openai) {
    throw new Error('OpenAI API key not configured');
  }
  return openai;
}

export interface EmailClassificationResult {
  class: 'support' | 'vendor' | 'unclear';
  confidence: number;
  reason: string;
  priority: 'low' | 'normal' | 'high';
  signals?: HeuristicSignals;
  method: 'ai' | 'heuristic';
}

export interface HeuristicSignals {
  isInternalDomain: boolean;
  vendorNoReply: boolean;
  otp: boolean;
  unsubscribe: boolean;
  marketing: boolean;
  finance: boolean;
  bounce: boolean;
  ooo: boolean;
  meeting: boolean;
  monitoring: boolean;
  helpLanguage: boolean;
  itTopics: boolean;
}

export interface EmailToClassify {
  from: string;
  subject: string;
  body: string;
  bodyPreview?: string;
}

/**
 * Extract heuristic signals from email content
 */
function extractHeuristicSignals(email: EmailToClassify): HeuristicSignals {
  const senderEmail = email.from.toLowerCase();
  const senderDomain = (senderEmail.split('@')[1] || '').toLowerCase();
  const isInternal = senderDomain === 'surterreproperties.com';

  const subject = String(email.subject || '').slice(0, 300);
  const body = String(email.body || email.bodyPreview || '').slice(0, 4000);

  // Regex patterns for detection
  const patterns = {
    vendorNoReply: /\b(no-?reply|do-?not-?reply)\b/i,
    otp: /\b(one[-\s]?time|verification|auth(entication)?|code|otp)\b/i,
    unsubscribe: /\bunsubscribe|manage preferences|view in browser\b/i,
    marketing: /\b(newsletter|sale|promotion|webinar|special offer|discount|% off)\b/i,
    finance: /\b(invoice|receipt|order\s?#?\d+|statement|payment)\b/i,
    bounce: /\b(delivery status notification|mail delivery failed|undeliverable)\b/i,
    ooo: /\b(out of office|automatic reply|auto\-reply)\b/i,
    meeting: /\b(invitation|meeting|calendar|event|accepted|declined)\b/i,
    monitoring: /\b(alert|incident|uptime|down|status page|monitoring|alarm)\b/i,
    help: /\b(please help|can you|i need|how do i|i can(?:'|')t|not working|issue|error|stopped working|access|permission)\b/i,
    itTopics: /\b(password|account|login|access|email|printer|software|hardware|vpn|network|wifi|mfa|security|setup|install)\b/i,
  };

  return {
    isInternalDomain: isInternal,
    vendorNoReply: patterns.vendorNoReply.test(senderEmail) || patterns.vendorNoReply.test(subject) || patterns.vendorNoReply.test(body),
    otp: patterns.otp.test(subject) || patterns.otp.test(body),
    unsubscribe: patterns.unsubscribe.test(body),
    marketing: patterns.marketing.test(subject) || patterns.marketing.test(body),
    finance: patterns.finance.test(subject) || patterns.finance.test(body),
    bounce: patterns.bounce.test(subject) || patterns.bounce.test(body),
    ooo: patterns.ooo.test(subject) || patterns.ooo.test(body),
    meeting: patterns.meeting.test(subject) || patterns.meeting.test(body),
    monitoring: patterns.monitoring.test(subject) || patterns.monitoring.test(body),
    helpLanguage: patterns.help.test(subject) || patterns.help.test(body),
    itTopics: patterns.itTopics.test(subject) || patterns.itTopics.test(body),
  };
}

/**
 * Apply heuristic-only classification (fallback when AI unavailable)
 */
function classifyByHeuristics(email: EmailToClassify, signals: HeuristicSignals): EmailClassificationResult {
  // Definite vendor signals
  if (signals.vendorNoReply || signals.marketing || signals.otp || signals.unsubscribe) {
    return {
      class: 'vendor',
      confidence: 0.9,
      reason: 'Detected vendor patterns (no-reply, marketing, OTP, or unsubscribe)',
      priority: 'low',
      signals,
      method: 'heuristic',
    };
  }

  // Automatic/system emails
  if (signals.ooo || signals.bounce || signals.meeting) {
    return {
      class: 'vendor',
      confidence: 0.85,
      reason: 'Automatic system email (OOO, bounce, or meeting)',
      priority: 'low',
      signals,
      method: 'heuristic',
    };
  }

  // Strong support signals
  if (signals.isInternalDomain && (signals.helpLanguage || signals.itTopics)) {
    return {
      class: 'support',
      confidence: 0.85,
      reason: 'Internal user requesting help with IT topics',
      priority: 'normal',
      signals,
      method: 'heuristic',
    };
  }

  // Weak support signals
  if (signals.helpLanguage || signals.itTopics) {
    return {
      class: 'support',
      confidence: 0.7,
      reason: 'Help language or IT topics detected',
      priority: 'normal',
      signals,
      method: 'heuristic',
    };
  }

  // Default: unclear
  return {
    class: 'unclear',
    confidence: 0.5,
    reason: 'No strong classification signals detected',
    priority: 'normal',
    signals,
    method: 'heuristic',
  };
}

/**
 * Classify email using OpenAI GPT
 */
async function classifyWithAI(email: EmailToClassify, signals: HeuristicSignals): Promise<EmailClassificationResult> {
  const senderEmail = email.from.toLowerCase();
  const senderDomain = (senderEmail.split('@')[1] || '').toLowerCase();
  const isInternal = senderDomain === 'surterreproperties.com';

  const subject = String(email.subject || '').slice(0, 300);
  const body = String(email.body || email.bodyPreview || '').slice(0, 4000);

  const systemPrompt = `Return STRICT JSON only: {"class":"support|vendor|unclear","confidence":0.0-1.0,"reason":"...","priority":"low|normal|high"}`;

  const userContent = [
    `From: ${senderEmail}${isInternal ? ' (company domain)' : ''}`,
    `Domain: ${senderDomain || 'unknown'}`,
    `Subject: ${subject}`,
    `Body: ${body}`,
    `Heuristics: ${JSON.stringify(signals)}`,
  ].join('\n');

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.0,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content in AI response');
    }

    // Clean JSON (remove code blocks if present)
    let cleanContent = content.trim();
    if (cleanContent.startsWith('```')) {
      cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    }

    const classification = JSON.parse(cleanContent);

    // Validate required fields
    if (!classification.class || !['support', 'vendor', 'unclear'].includes(classification.class)) {
      throw new Error('Invalid class in AI response');
    }

    return {
      class: classification.class,
      confidence: typeof classification.confidence === 'number' ? classification.confidence : 0.7,
      reason: classification.reason || 'AI classification',
      priority: classification.priority || 'normal',
      signals,
      method: 'ai',
    };
  } catch (error: any) {
    console.error('AI classification failed:', error.message);
    // Fallback to heuristic classification
    const heuristicResult = classifyByHeuristics(email, signals);
    heuristicResult.reason = `AI failed (${error.message}), using heuristics: ${heuristicResult.reason}`;
    return heuristicResult;
  }
}

/**
 * Main classification function
 *
 * @param email - Email to classify
 * @param useAI - Whether to use AI (default: true if OPENAI_API_KEY set)
 * @returns Classification result with class, confidence, reason, and priority
 *
 * @example
 * const result = await classifyEmail({
 *   from: 'user@surterreproperties.com',
 *   subject: 'Printer not working',
 *   body: 'My printer won't print. Please help!'
 * });
 *
 * console.log(result);
 * // {
 * //   class: 'support',
 * //   confidence: 0.95,
 * //   reason: 'Internal user requesting IT support',
 * //   priority: 'normal',
 * //   method: 'ai'
 * // }
 */
export async function classifyEmail(
  email: EmailToClassify,
  useAI: boolean = process.env.EMAIL_CLASSIFICATION_ENABLED !== 'false'
): Promise<EmailClassificationResult> {
  // Extract heuristic signals first
  const signals = extractHeuristicSignals(email);

  // Use AI if enabled and available
  if (useAI && process.env.OPENAI_API_KEY) {
    return await classifyWithAI(email, signals);
  }

  // Fallback to heuristics only
  return classifyByHeuristics(email, signals);
}

/**
 * Batch classify multiple emails
 *
 * @param emails - Array of emails to classify
 * @param useAI - Whether to use AI classification
 * @returns Array of classification results
 */
export async function classifyEmails(
  emails: EmailToClassify[],
  useAI: boolean = process.env.EMAIL_CLASSIFICATION_ENABLED !== 'false'
): Promise<EmailClassificationResult[]> {
  const results: EmailClassificationResult[] = [];

  for (const email of emails) {
    try {
      const result = await classifyEmail(email, useAI);
      results.push(result);
    } catch (error: any) {
      console.error(`Failed to classify email from ${email.from}:`, error.message);
      // Return unclear classification on error
      results.push({
        class: 'unclear',
        confidence: 0.3,
        reason: `Classification error: ${error.message}`,
        priority: 'normal',
        method: 'heuristic',
      });
    }
  }

  return results;
}
