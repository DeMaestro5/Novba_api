/**
 * Shared PDF service — converts HTML to PDF buffer.
 * Used by proposal, invoice, and contract routes for download and email attachments.
 * Single engine (Puppeteer); timeouts and errors handled here.
 */

import logger from '../core/Logger';

const PDF_DEFAULT_TIMEOUT_MS = 30_000;
const PDF_MAX_RETRIES = 1;

export interface PdfOptions {
  /** HTML string (full document) */
  html: string;
  /** Suggested filename for attachment (e.g. "invoice-001.pdf") */
  filename?: string;
  /** Timeout in ms for PDF generation */
  timeoutMs?: number;
}

/**
 * Generate a PDF buffer from HTML.
 * @returns PDF as Buffer, or null on failure (logged).
 */
export async function generatePdf(options: PdfOptions): Promise<Buffer | null> {
  const { html, timeoutMs = PDF_DEFAULT_TIMEOUT_MS } = options;

  if (!html || typeof html !== 'string') {
    logger.warn('PDF service: empty or invalid HTML');
    return null;
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= PDF_MAX_RETRIES; attempt++) {
    try {
      const buffer = await generatePdfOnce(html, timeoutMs);
      if (buffer && buffer.length > 0) {
        return buffer;
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn('PDF generation attempt failed', {
        attempt: attempt + 1,
        error: lastError.message,
      });
    }
  }

  logger.error('PDF generation failed after retries', {
    error: lastError?.message,
  });
  return null;
}

async function generatePdfOnce(
  html: string,
  timeoutMs: number,
): Promise<Buffer> {
  const puppeteer = await import('puppeteer');

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout: timeoutMs,
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
