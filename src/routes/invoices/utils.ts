import { Invoice } from '@prisma/client';
import { InvoiceWithDetails } from '../../database/repository/InvoicesRepo';

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
 * Generate invoice HTML for PDF
 */
export function generateInvoiceHTML(
  invoice: InvoiceWithDetails,
  user: any,
): string {
  const lineItemsHTML = invoice.lineItems
    .map(
      (item: any) => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">${invoice.currency} ${Number(item.rate).toFixed(2)}</td>
      <td style="text-align: right;">${invoice.currency} ${Number(item.amount).toFixed(2)}</td>
    </tr>
  `,
    )
    .join('');

  const statusColors: any = {
    DRAFT: '#6b7280',
    SENT: '#3b82f6',
    PAID: '#10b981',
    OVERDUE: '#ef4444',
    CANCELLED: '#6b7280',
    PARTIALLY_PAID: '#f59e0b',
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 40px;
          color: #333;
        }
        .header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 40px;
          border-bottom: 3px solid #4F46E5;
          padding-bottom: 20px;
        }
        .business-info {
          flex: 1;
        }
        .invoice-info {
          text-align: right;
        }
        .invoice-title {
          font-size: 32px;
          font-weight: bold;
          color: #4F46E5;
          margin-bottom: 10px;
        }
        .status-badge {
          display: inline-block;
          padding: 5px 15px;
          border-radius: 4px;
          color: white;
          font-size: 14px;
          font-weight: bold;
          margin-top: 10px;
          background-color: ${statusColors[invoice.status]};
        }
        .client-section {
          margin-bottom: 30px;
        }
        .section-title {
          font-size: 16px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #4F46E5;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        th, td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        th {
          background-color: #4F46E5;
          color: white;
          font-weight: bold;
        }
        .totals-section {
          text-align: right;
          margin-top: 20px;
        }
        .totals-row {
          margin: 10px 0;
          font-size: 16px;
        }
        .total-row {
          font-size: 20px;
          font-weight: bold;
          color: #4F46E5;
          margin-top: 15px;
          padding-top: 15px;
          border-top: 2px solid #4F46E5;
        }
        .notes-section, .terms-section {
          margin: 30px 0;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
        ${invoice.status === 'PAID' ? `
        .paid-stamp {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-20deg);
          font-size: 120px;
          font-weight: bold;
          color: rgba(16, 185, 129, 0.15);
          border: 10px solid rgba(16, 185, 129, 0.15);
          padding: 20px 50px;
          pointer-events: none;
        }
        ` : ''}
      </style>
    </head>
    <body>
      ${invoice.status === 'PAID' ? '<div class="paid-stamp">PAID</div>' : ''}
      
      <div class="header">
        <div class="business-info">
          <h1>${user.businessName || user.name}</h1>
          ${user.email ? `<p>${user.email}</p>` : ''}
          ${user.phone ? `<p>${user.phone}</p>` : ''}
          ${user.website ? `<p>${user.website}</p>` : ''}
          ${user.taxId ? `<p>Tax ID: ${user.taxId}</p>` : ''}
        </div>
        <div class="invoice-info">
          <div class="invoice-title">INVOICE</div>
          <p><strong>Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Issue Date:</strong> ${new Date(invoice.issueDate).toLocaleDateString()}</p>
          <p><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</p>
          <div class="status-badge">${invoice.status}</div>
        </div>
      </div>

      <div class="client-section">
        <div class="section-title">Bill To:</div>
        <p><strong>${invoice.client.companyName}</strong></p>
        ${invoice.client.contactName ? `<p>${invoice.client.contactName}</p>` : ''}
        ${invoice.client.email ? `<p>${invoice.client.email}</p>` : ''}
        ${invoice.client.billingAddress ? `<p>${JSON.stringify(invoice.client.billingAddress)}</p>` : ''}
      </div>

      ${invoice.project ? `
      <div style="margin-bottom: 20px; padding: 15px; background: #f3f4f6; border-radius: 4px;">
        <strong>Project:</strong> ${invoice.project.name}
      </div>
      ` : ''}

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: center;">Quantity</th>
            <th style="text-align: right;">Rate</th>
            <th style="text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${lineItemsHTML}
        </tbody>
      </table>

      <div class="totals-section">
        <div class="totals-row">
          <strong>Subtotal:</strong> ${invoice.currency} ${Number(invoice.subtotal).toFixed(2)}
        </div>
        <div class="totals-row">
          <strong>Tax (${Number(invoice.taxRate).toFixed(2)}%):</strong> ${invoice.currency} ${Number(invoice.taxAmount).toFixed(2)}
        </div>
        <div class="total-row">
          <strong>TOTAL:</strong> ${invoice.currency} ${Number(invoice.total).toFixed(2)}
        </div>
      </div>

      ${invoice.notes ? `
      <div class="notes-section">
        <div class="section-title">Notes</div>
        <p>${invoice.notes}</p>
      </div>
      ` : ''}

      ${invoice.terms ? `
      <div class="terms-section">
        <div class="section-title">Payment Terms</div>
        <p>${invoice.terms}</p>
      </div>
      ` : ''}

      <div class="footer">
        <p>Thank you for your business!</p>
        ${invoice.sentAt ? `<p>Sent on ${new Date(invoice.sentAt).toLocaleDateString()}</p>` : ''}
        ${invoice.paidAt ? `<p>Paid on ${new Date(invoice.paidAt).toLocaleDateString()}</p>` : ''}
      </div>
    </body>
    </html>
  `;
}