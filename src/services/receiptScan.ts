/**
 * Receipt scanning via OpenAI Vision. Extracts vendor, amount, date, category
 * for expense prefill. Requires OPENAI_API_KEY. No auto-create of expenses.
 */

import axios from 'axios';
import { ExpenseCategory } from '@prisma/client';
import logger from '../core/Logger';

const CATEGORIES = Object.values(ExpenseCategory);
const MAX_IMAGE_BASE64_LENGTH = 6_000_000; // ~4.5MB image
const OPENAI_MODEL = 'gpt-4o-mini';

export interface ScannedReceiptData {
  vendor: string;
  amount: number;
  date: string;
  category: string;
  currency?: string;
  description?: string;
}

const EXTRACTION_PROMPT = `Extract receipt data from this image. Return ONLY a valid JSON object (no markdown, no code block) with these exact keys:
- vendor (string): merchant/store name
- amount (number): total amount paid
- date (string): date in YYYY-MM-DD format
- category (string): exactly one of: ${CATEGORIES.join(', ')}
- currency (string, optional): e.g. USD
- description (string, optional): brief note

If something is unclear, use your best guess. For category pick the closest match from the list.`;

function normalizeCategory(raw: unknown): string {
  if (typeof raw !== 'string') return 'OTHER';
  const upper = raw.trim().toUpperCase().replace(/\s+/g, '_');
  return CATEGORIES.includes(upper as ExpenseCategory) ? upper : 'OTHER';
}

function parseContent(content: string): ScannedReceiptData {
  const trimmed = content.trim().replace(/^```\w*\n?|\n?```$/g, '').trim();
  const parsed = JSON.parse(trimmed) as Record<string, unknown>;
  const amount =
    typeof parsed.amount === 'number'
      ? parsed.amount
      : Number(parsed.amount) || 0;
  const date =
    typeof parsed.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
      ? parsed.date
      : new Date().toISOString().split('T')[0];
  return {
    vendor: typeof parsed.vendor === 'string' ? parsed.vendor.trim() : 'Unknown',
    amount: Math.round(amount * 100) / 100,
    date,
    category: normalizeCategory(parsed.category),
    currency:
      typeof parsed.currency === 'string' ? parsed.currency.trim() : undefined,
    description:
      typeof parsed.description === 'string'
        ? parsed.description.trim()
        : undefined,
  };
}

/**
 * Scan receipt image (base64) and return extracted fields for user to confirm.
 * Throws if OPENAI_API_KEY is missing, image too large, or provider error.
 */
export async function scanReceipt(
  imageBase64: string,
): Promise<ScannedReceiptData> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('Receipt scanning is not configured (missing OPENAI_API_KEY)');
  }

  const cleaned = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  if (!cleaned || cleaned.length > MAX_IMAGE_BASE64_LENGTH) {
    throw new Error(
      'Invalid or too large image (max ~4.5MB). Send a base64-encoded image.',
    );
  }

  const url = 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model: OPENAI_MODEL,
    max_tokens: 500,
    messages: [
      {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: EXTRACTION_PROMPT },
          {
            type: 'image_url' as const,
            image_url: {
              url: `data:image/jpeg;base64,${cleaned}`,
            },
          },
        ],
      },
    ],
  };

  try {
    const { data } = await axios.post(
      url,
      payload,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30_000,
      },
    );

    const choice = data?.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      logger.warn('Receipt scan: empty OpenAI response', { data });
      throw new Error('Receipt scan returned no data');
    }

    return parseContent(content);
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      const status = err.response?.status;
      const msg = err.response?.data?.error?.message ?? err.message;
      logger.warn('Receipt scan provider error', { status, message: msg });
      if (status === 401) {
        throw new Error('Receipt scanning is not configured (invalid API key)');
      }
      if (status === 429) {
        throw new Error('Receipt scanning rate limit reached. Try again shortly.');
      }
      throw new Error(
        `Receipt scan failed: ${typeof msg === 'string' ? msg : 'Provider error'}`,
      );
    }
    if (err instanceof Error) throw err;
    throw new Error('Receipt scan failed');
  }
}
