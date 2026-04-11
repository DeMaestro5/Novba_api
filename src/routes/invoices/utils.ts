import { Invoice } from '@prisma/client';
import { InvoiceWithDetails } from '../../database/repository/InvoicesRepo';

function formatDateForPdf(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMoneyForPdf(amount: unknown, currency: string): string {
  const n = typeof amount === 'number' ? amount : Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(n);
  } catch {
    return `${currency || 'USD'} ${n.toFixed(2)}`;
  }
}

function escapeHtml(input: unknown): string {
  const str = String(input ?? '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatAddressLines(address: any): string[] {
  if (!address || typeof address !== 'object') return [];
  const street = address.street ? String(address.street).trim() : '';
  const city = address.city ? String(address.city).trim() : '';
  const state = address.state ? String(address.state).trim() : '';
  const zip = address.zip ? String(address.zip).trim() : '';
  const country = address.country ? String(address.country).trim() : '';

  const cityLine = [city, state, zip].filter(Boolean).join(', ');
  return [street, cityLine, country].filter(Boolean);
}

/**
 * Format invoice data for response
 */
export function getInvoiceData(invoice: InvoiceWithDetails | Invoice) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    issueDate: invoice.issueDate,
    dueDate: invoice.dueDate,
    subtotal: invoice.subtotal,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
    currency: invoice.currency,
    notes: invoice.notes,
    terms: invoice.terms,
    pdfUrl: invoice.pdfUrl,
    sentAt: invoice.sentAt,
    paidAt: invoice.paidAt,
    scheduledSendAt: invoice.scheduledSendAt,
    lastReminderSentAt: invoice.lastReminderSentAt,
    reminderCount: invoice.reminderCount,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    // Include relations if present
    ...('lineItems' in invoice && { lineItems: invoice.lineItems }),
    ...('client' in invoice && { client: invoice.client }),
    ...('project' in invoice && { project: invoice.project }),
  };
}

/**
 * Calculate invoice totals from line items
 */
export function calculateInvoiceTotals(
  lineItems: Array<{ quantity: number; rate: number }>,
  taxRate: number = 0,
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = lineItems.reduce((sum, item) => {
    return sum + item.quantity * item.rate;
  }, 0);

  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

/**
 * Calculate days overdue
 */
export function calculateDaysOverdue(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

/**
 * Generate invoice HTML for PDF — aligned with InvoiceDetailPage UI
 * so the downloaded PDF matches what the user sees on screen.
 */
export function generateInvoiceHTML(
  invoice: InvoiceWithDetails,
  user: any,
): string {
  const money = (v: unknown) => formatMoneyForPdf(v, invoice.currency || 'USD');
  const issueDate = formatDateForPdf(invoice.issueDate);
  const dueDate = formatDateForPdf(invoice.dueDate);

  const businessName = escapeHtml(user?.businessName || user?.name || '');
  const userEmail = user?.businessEmail || user?.email || '';
  const userPhone = user?.businessPhone || user?.phone || '';
  const businessLogo = user?.businessLogo || user?.logoUrl || '';
  const addressParts = [
    user?.businessAddress,
    user?.businessCity,
    user?.businessState,
    user?.businessZipCode,
    user?.businessCountry,
  ].filter(Boolean);
  const businessAddress = addressParts.map(escapeHtml).join(', ');
  const taxId = user?.taxId ? escapeHtml(user.taxId) : '';

  const companyName = escapeHtml(invoice.client?.companyName || '');
  const contactName = escapeHtml(invoice.client?.contactName || '');
  const clientEmail = escapeHtml(invoice.client?.email || '');
  const addressLines = formatAddressLines(invoice.client?.billingAddress).map(
    escapeHtml,
  );
  const clientInitial = (invoice.client?.companyName || '?')[0].toUpperCase();

  const statusColors: Record<string, { bg: string; text: string }> = {
    DRAFT: { bg: '#f3f4f6', text: '#6b7280' },
    SENT: { bg: '#eff6ff', text: '#3b82f6' },
    PAID: { bg: '#f0fdf4', text: '#16a34a' },
    OVERDUE: { bg: '#fef2f2', text: '#dc2626' },
    CANCELLED: { bg: '#f3f4f6', text: '#6b7280' },
    PARTIALLY_PAID: { bg: '#fffbeb', text: '#d97706' },
  };
  const sc = statusColors[invoice.status] || statusColors.DRAFT;
  const statusLabel = invoice.status.replace('_', ' ');

  const taxRateDisplay = Number(invoice.taxRate);
  const taxRateStr =
    taxRateDisplay === Math.round(taxRateDisplay)
      ? String(taxRateDisplay)
      : taxRateDisplay.toFixed(2);

  const lineItemsHTML = invoice.lineItems
    .map(
      (item: any, i: number) => `
      <tr style="border-top:1px solid ${i === 0 ? '#e5e7eb' : '#f3f4f6'};">
        <td style="padding:14px 16px;color:#111827;font-weight:500;">${escapeHtml(
          item.description,
        )}</td>
        <td style="padding:14px 16px;text-align:right;color:#6b7280;">${escapeHtml(
          String(item.quantity),
        )}</td>
        <td style="padding:14px 16px;text-align:right;color:#6b7280;">${money(
          item.rate,
        )}</td>
        <td style="padding:14px 16px;text-align:right;color:#111827;font-weight:600;">${money(
          item.amount,
        )}</td>
      </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f9fafb;
      padding: 32px 24px 48px;
      color: #111827;
      font-size: 14px;
      line-height: 1.5;
    }
    .card {
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      overflow: hidden;
      max-width: 780px;
      margin: 0 auto;
    }
    .header {
      padding: 32px 32px 28px;
      border-bottom: 1px solid #f3f4f6;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
    }
    .logo-mark {
      width: 44px; height: 44px;
      background: #fff7ed;
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 12px;
    }
    .business-name { font-size: 16px; font-weight: 700; color: #111827; margin-bottom: 2px; }
    .business-detail { font-size: 13px; color: #6b7280; margin-top: 2px; }
    .invoice-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: #9ca3af; text-align: right;
      margin-bottom: 6px;
    }
    .invoice-number { font-size: 28px; font-weight: 900; color: #111827; text-align: right; }
    .date-row { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
    .date-label { font-size: 12px; color: #9ca3af; width: 42px; text-align: right; }
    .date-value { font-size: 13px; font-weight: 600; color: #111827; }
    .status-badge {
      display: inline-block; margin-top: 10px; float: right;
      padding: 4px 12px; border-radius: 20px;
      font-size: 11px; font-weight: 700; letter-spacing: 0.03em;
      background: ${sc.bg}; color: ${sc.text};
    }
    .billto-section {
      padding: 24px 32px;
      border-bottom: 1px solid #f3f4f6;
    }
    .section-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: #9ca3af; margin-bottom: 12px;
    }
    .client-row { display: flex; align-items: flex-start; gap: 12px; }
    .client-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: #fff7ed; color: #ea580c;
      font-size: 14px; font-weight: 700;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .client-name { font-size: 14px; font-weight: 600; color: #111827; }
    .client-detail { font-size: 13px; color: #6b7280; margin-top: 2px; }
    .client-address { font-size: 13px; color: #6b7280; margin-top: 4px; line-height: 1.5; }
    .items-section { padding: 0; }
    table { width: 100%; border-collapse: collapse; }
    .items-header th {
      padding: 12px 16px; text-align: left;
      font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; color: #9ca3af;
      background: #f9fafb;
    }
    .th-right { text-align: right !important; }
    .totals-section {
      padding: 16px 32px 24px;
      display: flex; justify-content: flex-end;
    }
    .totals-box { width: 280px; }
    .totals-line {
      display: flex; justify-content: space-between;
      font-size: 13px; color: #6b7280; padding: 4px 0;
    }
    .totals-total {
      display: flex; justify-content: space-between;
      padding: 12px 0 0; margin-top: 8px;
      border-top: 1px solid #e5e7eb;
      font-size: 15px; font-weight: 700; color: #111827;
    }
    .total-amount { color: #ea580c; font-weight: 900; }
    .extra-section {
      padding: 20px 32px;
      border-top: 1px solid #f3f4f6;
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    }
    .extra-label {
      font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: #9ca3af; margin-bottom: 6px;
    }
    .extra-body { font-size: 13px; color: #374151; white-space: pre-wrap; line-height: 1.6; }
    .footer {
      padding: 16px 32px;
      border-top: 1px solid #f3f4f6;
      text-align: center;
      background: #f9fafb;
    }
    .footer-text { font-size: 11px; color: #9ca3af; }
    .footer-brand { font-weight: 700; }
    .footer-brand .nov { color: #111827; }
    .footer-brand .ba { color: #ea580c; }
    ${
      invoice.status === 'PAID'
        ? `
    .paid-watermark {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-15deg);
      font-size: 96px; font-weight: 900; letter-spacing: 0.05em;
      color: rgba(34, 197, 94, 0.15); pointer-events: none; z-index: 0;
    }`
        : ''
    }
  </style>
</head>
<body>
  ${invoice.status === 'PAID' ? '<div class="paid-watermark">PAID</div>' : ''}

  <div class="card">
    <!-- Header -->
    <div class="header">
      <div>
        <div class="logo-mark">
          ${
            businessLogo
              ? `<img src="${escapeHtml(
                  businessLogo,
                )}" style="width:28px;height:28px;object-fit:contain;" />`
              : `<svg width="22" height="22" fill="none" stroke="#ea580c" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
               </svg>`
          }
        </div>
        <p class="business-name">${businessName}</p>
        ${
          userEmail
            ? `<p class="business-detail">${escapeHtml(userEmail)}</p>`
            : ''
        }
        ${
          userPhone
            ? `<p class="business-detail">${escapeHtml(userPhone)}</p>`
            : ''
        }
        ${
          businessAddress
            ? `<p class="business-detail">${businessAddress}</p>`
            : ''
        }
        ${taxId ? `<p class="business-detail">Tax ID: ${taxId}</p>` : ''}
      </div>
      <div style="text-align:right;min-width:200px;">
        <p class="invoice-label">Invoice</p>
        <p class="invoice-number">${escapeHtml(invoice.invoiceNumber)}</p>
        <div style="margin-top:10px;">
          <div class="date-row">
            <span class="date-label">Issued</span>
            <span class="date-value">${issueDate}</span>
          </div>
          <div class="date-row" style="margin-top:4px;">
            <span class="date-label">Due</span>
            <span class="date-value" style="color:#111827;">${dueDate}</span>
          </div>
        </div>
        <span class="status-badge">${escapeHtml(statusLabel)}</span>
      </div>
    </div>

    <!-- Bill To -->
    <div class="billto-section">
      <p class="section-label">Bill To</p>
      <div class="client-row">
        <div class="client-avatar">${clientInitial}</div>
        <div>
          <p class="client-name">${companyName}</p>
          ${contactName ? `<p class="client-detail">${contactName}</p>` : ''}
          ${clientEmail ? `<p class="client-detail">${clientEmail}</p>` : ''}
          ${
            addressLines.length > 0
              ? `<p class="client-address">${addressLines.join('<br>')}</p>`
              : ''
          }
        </div>
      </div>
    </div>

    <!-- Line Items -->
    <div class="items-section">
      <table>
        <thead>
          <tr class="items-header">
            <th>Description</th>
            <th class="th-right">Qty</th>
            <th class="th-right">Rate</th>
            <th class="th-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHTML}
        </tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals-section">
      <div class="totals-box">
        <div class="totals-line">
          <span>Subtotal</span>
          <span style="color:#111827;font-weight:500;">${money(
            invoice.subtotal,
          )}</span>
        </div>
        <div class="totals-line">
          <span>Tax (${taxRateStr}%)</span>
          <span style="color:#111827;font-weight:500;">${money(
            invoice.taxAmount,
          )}</span>
        </div>
        <div class="totals-total">
          <span>Total</span>
          <span class="total-amount">${money(invoice.total)}</span>
        </div>
      </div>
    </div>

    <!-- Notes & Terms -->
    ${
      invoice.notes || invoice.terms
        ? `
    <div class="extra-section">
      ${
        invoice.notes
          ? `
      <div>
        <p class="extra-label">Notes</p>
        <p class="extra-body">${escapeHtml(invoice.notes)}</p>
      </div>`
          : '<div></div>'
      }
      ${
        invoice.terms
          ? `
      <div>
        <p class="extra-label">Terms</p>
        <p class="extra-body">${escapeHtml(invoice.terms)}</p>
      </div>`
          : ''
      }
    </div>`
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      <p class="footer-text">
        Created with <span class="footer-brand"><span class="nov">nov</span><span class="ba">ba</span></span>
        &nbsp;·&nbsp; Invoice software for the Notion generation
        &nbsp;·&nbsp; usenovba.com
      </p>
    </div>
  </div>
</body>
</html>`;
}
