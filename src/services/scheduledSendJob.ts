import cron from 'node-cron';
import prisma from '../database';
import { InvoiceStatus, EmailType, EmailStatus } from '@prisma/client';
import { generateInvoiceHTML } from '../routes/invoices/utils';
import { generatePdf } from './pdf';
import { sendEmail } from './Email.service';
import { logEmail } from './emailLog';

/**
 * Scheduled Send Job
 * Runs every 15 minutes.
 * Finds all DRAFT invoices where scheduledSendAt <= now,
 * sends each one, then clears scheduledSendAt and marks as SENT.
 */
export function startScheduledSendJob(): void {
  cron.schedule('*/15 * * * *', async () => {
    console.log('[ScheduledSendJob] Checking for scheduled invoices...');

    try {
      const now = new Date();

      const invoices = await prisma.invoice.findMany({
        where: {
          status: InvoiceStatus.DRAFT,
          scheduledSendAt: {
            lte: now,
          },
        },
        include: {
          lineItems: {
            orderBy: { order: 'asc' },
          },
          client: {
            select: {
              id: true,
              companyName: true,
              contactName: true,
              email: true,
              billingAddress: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          user: true,
        },
      });

      if (invoices.length === 0) {
        console.log('[ScheduledSendJob] No invoices due to send.');
        return;
      }

      console.log(
        `[ScheduledSendJob] Found ${invoices.length} invoice(s) to send.`,
      );

      for (const invoice of invoices) {
        const clientEmail = invoice.client?.email;

        if (!clientEmail) {
          console.warn(
            `[ScheduledSendJob] Invoice ${invoice.invoiceNumber} skipped — client has no email.`,
          );
          // Clear the schedule so it doesn't retry forever
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { scheduledSendAt: null },
          });
          continue;
        }

        let emailSent = false;
        let emailError: string | undefined;

        try {
          const htmlContent = generateInvoiceHTML(invoice as any, invoice.user);
          const pdfBuffer = await generatePdf({
            html: htmlContent,
            filename: `invoice-${invoice.invoiceNumber}.pdf`,
          });

          if (pdfBuffer) {
            const subject = `Invoice ${invoice.invoiceNumber} from ${
              invoice.user?.name || 'Us'
            }`;
            emailSent = await sendEmail({
              to: clientEmail,
              subject,
              html: '<p>Please find your invoice attached.</p>',
              attachments: [
                {
                  filename: `invoice-${invoice.invoiceNumber}.pdf`,
                  content: pdfBuffer,
                },
              ],
            });
            if (!emailSent)
              emailError = 'Email provider did not confirm send';
          } else {
            emailError = 'PDF generation failed';
          }
        } catch (err) {
          emailError = err instanceof Error ? err.message : 'Send failed';
          console.error(
            `[ScheduledSendJob] Failed to send invoice ${invoice.invoiceNumber}:`,
            emailError,
          );
        }

        // Mark as SENT and clear scheduledSendAt regardless of email outcome
        // so we don't retry on the next tick
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.SENT,
            sentAt: new Date(),
            scheduledSendAt: null,
            updatedAt: new Date(),
          },
        });

        await logEmail({
          userId: invoice.userId,
          recipient: clientEmail,
          subject: `Invoice ${invoice.invoiceNumber}`,
          type: EmailType.INVOICE_SENT,
          status: emailSent ? EmailStatus.SENT : EmailStatus.FAILED,
          invoiceId: invoice.id,
          sentAt: emailSent ? new Date() : undefined,
          error: emailError,
        });

        console.log(
          `[ScheduledSendJob] Invoice ${invoice.invoiceNumber} — email ${
            emailSent ? 'sent ✓' : 'failed ✗'
          }`,
        );
      }
    } catch (err) {
      console.error('[ScheduledSendJob] Unexpected error:', err);
    }
  });

  console.log('[ScheduledSendJob] Scheduled — runs every 15 minutes');
}

