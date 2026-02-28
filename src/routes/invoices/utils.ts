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
    lastReminderSentAt: invoice.lastReminderSentAt,
    reminderCount: invoice.reminderCount,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
    // Include relations if present
    ...(('lineItems' in invoice) && { lineItems: invoice.lineItems }),
    ...(('client' in invoice) && { client: invoice.client }),
    ...(('project' in invoice) && { project: invoice.project }),
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
  // Badge colors matching getStatusBadgeVariant: success=green, info=blue, danger=red, warning=amber, default=gray
  const statusColors: Record<string, string> = {
    DRAFT: '#6b7280',
    SENT: '#3b82f6',
    PAID: '#10b981',
    OVERDUE: '#ef4444',
    CANCELLED: '#6b7280',
    PARTIALLY_PAID: '#f59e0b',
  };

  const money = (v: unknown) => formatMoneyForPdf(v, invoice.currency || 'USD');
  const issueDate = formatDateForPdf(invoice.issueDate);
  const dueDate = formatDateForPdf(invoice.dueDate);
  const safeBusinessName = escapeHtml(user?.businessName || user?.name || '');
  const safeUserEmail = user?.email ? escapeHtml(user.email) : '';
  const safeUserPhone = user?.phone ? escapeHtml(user.phone) : '';
  const safeUserAddress = user?.address ? escapeHtml(user.address) : '';
  const safeTaxId = user?.taxId ? escapeHtml(user.taxId) : '';

  // Bill To: company (font-medium), then contact, email, then address lines (whitespace-pre-line)
  const companyName = invoice.client?.companyName
    ? escapeHtml(invoice.client.companyName)
    : '';
  const contactName = invoice.client?.contactName
    ? escapeHtml(invoice.client.contactName)
    : '';
  const clientEmail = invoice.client?.email
    ? escapeHtml(invoice.client.email)
    : '';
  const addressLines = formatAddressLines(invoice.client?.billingAddress).map(
    escapeHtml,
  );
  const addressBlock =
    addressLines.length > 0
      ? `<p class="billto-address">${addressLines.join('<br>')}</p>`
      : '';

  const lineItemsHTML = invoice.lineItems
    .map(
      (item: any) => `
    <tr class="item-row">
      <td class="cell-desc">${escapeHtml(item.description)}</td>
      <td class="cell-qty">${escapeHtml(String(item.quantity))}</td>
      <td class="cell-rate">${money(item.rate)}</td>
      <td class="cell-amt">${money(item.amount)}</td>
    </tr>
  `,
    )
    .join('');

  const statusLabel = invoice.status.replace('_', ' ');
  const taxRateDisplay = Number(invoice.taxRate);
  const taxRateStr =
    taxRateDisplay === Math.round(taxRateDisplay)
      ? String(taxRateDisplay)
      : taxRateDisplay.toFixed(2);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        /* Match InvoiceDetailPage: gray scale, same typography and spacing */
        body {
          font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 32px 24px 48px;
          color: #111827;
          font-size: 14px;
        }
        .top-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 24px;
          padding-bottom: 24px;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 32px;
        }
        .business-block { }
        .business-name {
          font-size: 18px;
          font-weight: 700;
          color: #111827;
          margin: 0 0 4px 0;
        }
        .business-line {
          font-size: 14px;
          color: #4b5563;
          margin: 2px 0 0 0;
        }
        .business-address {
          font-size: 14px;
          color: #4b5563;
          margin: 4px 0 0 0;
          white-space: pre-line;
        }
        .invoice-meta {
          text-align: right;
        }
        .invoice-number {
          font-size: 18px;
          font-weight: 600;
          color: #111827;
          margin: 0 0 4px 0;
        }
        .invoice-date {
          font-size: 14px;
          color: #4b5563;
          margin: 2px 0 0 0;
        }
        .status-badge {
          display: inline-block;
          margin-top: 8px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          background-color: ${statusColors[invoice.status] || '#6b7280'};
        }
        .billto-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          margin: 0 0 8px 0;
        }
        .billto-company {
          font-weight: 500;
          color: #111827;
          margin: 0;
        }
        .billto-line {
          font-size: 14px;
          color: #4b5563;
          margin: 2px 0 0 0;
        }
        .billto-address {
          font-size: 14px;
          color: #4b5563;
          margin: 4px 0 0 0;
          line-height: 1.4;
        }
        .table-wrap {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
          margin: 32px 0 16px 0;
        }
        .items {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .items thead tr {
          background: #f9fafb;
        }
        .items th {
          padding: 12px 16px;
          text-align: left;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
        }
        .items th.th-qty, .items th.th-rate, .items th.th-amt { text-align: right; }
        .item-row td {
          padding: 12px 16px;
          border-top: 1px solid #f3f4f6;
          color: #111827;
        }
        .cell-desc { color: #111827; }
        .cell-qty, .cell-rate { text-align: right; color: #374151; }
        .cell-amt { text-align: right; font-weight: 600; color: #111827; }
        .totals-wrap {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }
        .totals-box {
          width: 320px;
        }
        .totals-line {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          color: #374151;
          margin: 4px 0;
        }
        .totals-total {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid #e5e7eb;
          font-size: 18px;
          font-weight: 700;
          color: #111827;
        }
        .section-label {
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          margin: 0 0 8px 0;
        }
        .section-body {
          font-size: 14px;
          color: #374151;
          margin: 0;
          white-space: pre-line;
        }
        .notes-block, .terms-block {
          margin-top: 32px;
        }
        ${invoice.status === 'PAID' ? `
        .paid-watermark {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-15deg);
          font-size: 96px;
          font-weight: 900;
          letter-spacing: 0.05em;
          color: rgba(34, 197, 94, 0.2);
          pointer-events: none;
        }
        ` : ''}
      </style>
    </head>
    <body>
      ${invoice.status === 'PAID' ? '<div class="paid-watermark">PAID</div>' : ''}

      <div class="top-row">
        <div class="business-block">
          <h2 class="business-name">${safeBusinessName}</h2>
          ${safeUserEmail ? `<p class="business-line">${safeUserEmail}</p>` : ''}
          ${safeUserPhone ? `<p class="business-line">${safeUserPhone}</p>` : ''}
          ${safeUserAddress ? `<p class="business-address">${safeUserAddress}</p>` : ''}
          ${safeTaxId ? `<p class="business-line">Tax ID: ${safeTaxId}</p>` : ''}
        </div>
        <div class="invoice-meta">
          <p class="invoice-number">${escapeHtml(invoice.invoiceNumber)}</p>
          <p class="invoice-date">Issue date: ${issueDate}</p>
          <p class="invoice-date">Due date: ${dueDate}</p>
          <span class="status-badge">${escapeHtml(statusLabel)}</span>
        </div>
      </div>

      <div class="billto-label">Bill To</div>
      <p class="billto-company">${companyName}</p>
      ${contactName ? `<p class="billto-line">${contactName}</p>` : ''}
      ${clientEmail ? `<p class="billto-line">${clientEmail}</p>` : ''}
      ${addressBlock}

      ${invoice.project ? `<div class="table-wrap" style="margin-bottom:16px;"><table class="items"><tr><td style="padding:12px 16px; background:#f9fafb; font-weight:600;">Project: ${escapeHtml(invoice.project.name)}</td></tr></table></div>` : ''}

      <div class="table-wrap">
        <table class="items">
          <thead>
            <tr>
              <th>Description</th>
              <th class="th-qty">Quantity</th>
              <th class="th-rate">Rate</th>
              <th class="th-amt">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHTML}
          </tbody>
        </table>
      </div>

      <div class="totals-wrap">
        <div class="totals-box">
          <div class="totals-line">
            <span>Subtotal</span>
            <span>${money(invoice.subtotal)}</span>
          </div>
          <div class="totals-line">
            <span>Tax (${taxRateStr}%)</span>
            <span>${money(invoice.taxAmount)}</span>
          </div>
          <div class="totals-total">
            <span>Total</span>
            <span>${money(invoice.total)}</span>
          </div>
        </div>
      </div>

      ${invoice.notes ? `
      <div class="notes-block">
        <div class="section-label">Notes</div>
        <p class="section-body">${escapeHtml(invoice.notes)}</p>
      </div>
      ` : ''}

      ${invoice.terms ? `
      <div class="terms-block">
        <div class="section-label">Terms</div>
        <p class="section-body">${escapeHtml(invoice.terms)}</p>
      </div>
      ` : ''}
    </body>
    </html>
  `;
}