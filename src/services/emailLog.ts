/**
 * Email logging helper — writes every sent (or attempted) transactional email to EmailLog
 * for audit and support. All document-send and notification flows should log here.
 */

import { EmailStatus, EmailType } from '@prisma/client';
import prisma from '../database';

export interface LogEmailParams {
  userId: string;
  recipient: string;
  subject: string;
  type: EmailType;
  status: EmailStatus;
  /** Set when logging invoice-related emails */
  invoiceId?: string | null;
  /** Set when email was actually sent (for SENT status) */
  sentAt?: Date | null;
  /** Set when status is FAILED; store provider error message (safe for DB) */
  error?: string | null;
}

/**
 * Create an EmailLog record. Call after sendEmail() (or after a failed send) so every
 * transactional email is auditable.
 */
export async function logEmail(params: LogEmailParams): Promise<void> {
  const { userId, recipient, subject, type, status, invoiceId, sentAt, error } =
    params;

  await prisma.emailLog.create({
    data: {
      userId,
      recipient,
      subject,
      type,
      status,
      invoiceId: invoiceId ?? undefined,
      sentAt: sentAt ?? undefined,
      error: error ?? undefined,
    },
  });
}
