import { Proposal } from '@prisma/client';
import { ProposalWithDetails } from '../../database/repository/ProposalRepo';

/**
 * Format proposal data for response
 */
export function getProposalData(proposal: ProposalWithDetails | Proposal) {
  return {
    id: proposal.id,
    proposalNumber: proposal.proposalNumber,
    title: proposal.title,
    status: proposal.status,
    scope: proposal.scope,
    deliverables: proposal.deliverables,
    timeline: proposal.timeline,
    terms: proposal.terms,
    totalAmount: proposal.totalAmount,
    currency: proposal.currency,
    validUntil: proposal.validUntil,
    sentAt: proposal.sentAt,
    viewedAt: proposal.viewedAt,
    respondedAt: proposal.respondedAt,
    pdfUrl: proposal.pdfUrl,
    createdAt: proposal.createdAt,
    updatedAt: proposal.updatedAt,
    // Include relations if present
    ...('lineItems' in proposal && { lineItems: proposal.lineItems }),
    ...('client' in proposal && { client: proposal.client }),
  };
}

/**
 * Calculate total amount from line items
 */
export function calculateTotal(
  lineItems: Array<{ quantity: number; rate: number }>,
): number {
  return lineItems.reduce((sum, item) => {
    return sum + item.quantity * item.rate;
  }, 0);
}

/**
 * Generate PDF content (HTML template)
 * This will be used with a PDF generator like Puppeteer
 */
export function generateProposalHTML(
  proposal: ProposalWithDetails,
  user: any,
): string {
  const businessName = user.businessName || user.name || user.firstName || user.email || 'Your Business';
  const businessEmail = user.businessEmail || user.email || '';
  const createdDate = new Date(proposal.createdAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
  const validUntilFormatted = proposal.validUntil
    ? new Date(proposal.validUntil).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: proposal.currency || 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const lineItemsHTML = proposal.lineItems
    .map(
      (item: any, index: number) => `
        <tr style="border-bottom: 1px solid ${index % 2 === 0 ? '#f9fafb' : '#ffffff'};">
          <td style="padding: 12px 16px; font-size: 13px; color: #374151;">${item.description}</td>
          <td style="padding: 12px 16px; font-size: 13px; color: #6b7280; text-align: center;">${Number(item.quantity)}</td>
          <td style="padding: 12px 16px; font-size: 13px; color: #6b7280; text-align: right;">${formatCurrency(Number(item.rate))}</td>
          <td style="padding: 12px 16px; font-size: 13px; font-weight: 600; color: #111827; text-align: right;">${formatCurrency(Number(item.amount))}</td>
        </tr>
      `,
    )
    .join('');

  const total = proposal.lineItems.reduce(
    (sum: number, item: any) => sum + Number(item.quantity) * Number(item.rate),
    0,
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proposal — ${proposal.proposalNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      background: #ffffff;
      color: #111827;
      font-size: 14px;
      line-height: 1.5;
    }
    .page {
      max-width: 760px;
      margin: 0 auto;
      padding: 48px 48px;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 24px;
    }
    .business-name {
      font-size: 20px;
      font-weight: 700;
      color: #111827;
    }
    .business-email {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 2px;
    }
    .proposal-label-block {
      text-align: right;
    }
    .proposal-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #ea580c;
    }
    .proposal-meta {
      font-size: 11px;
      color: #9ca3af;
      margin-top: 2px;
      line-height: 1.6;
    }

    /* ── Orange accent bar ── */
    .accent-bar {
      height: 2px;
      background: linear-gradient(to right, #ea580c, #fdba74);
      border-radius: 2px;
      margin-bottom: 28px;
    }

    /* ── Prepared for ── */
    .section-label {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #9ca3af;
      margin-bottom: 4px;
    }
    .client-name {
      font-size: 15px;
      font-weight: 600;
      color: #111827;
    }
    .client-sub {
      font-size: 12px;
      color: #6b7280;
      margin-top: 1px;
    }

    /* ── Proposal title ── */
    .proposal-title {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
      margin-top: 24px;
      margin-bottom: 24px;
    }

    /* ── Sections ── */
    .section {
      margin-bottom: 28px;
    }
    .section-body {
      font-size: 13px;
      color: #4b5563;
      line-height: 1.7;
      white-space: pre-wrap;
    }

    /* ── Pricing table ── */
    .table-wrapper {
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      overflow: hidden;
      margin-top: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    thead tr {
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      padding: 10px 16px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: #6b7280;
      text-align: left;
    }
    th.right { text-align: right; }
    th.center { text-align: center; }
    .total-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 16px;
      background: #f9fafb;
      border-top: 1px solid #d1d5db;
    }
    .total-label {
      font-size: 13px;
      font-weight: 600;
      color: #374151;
    }
    .total-value {
      font-size: 18px;
      font-weight: 700;
      color: #111827;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left {
      font-size: 11px;
      color: #9ca3af;
    }
    .footer-right {
      font-size: 11px;
      color: #9ca3af;
    }
    .novba-badge {
      font-size: 11px;
      color: #d1d5db;
      font-weight: 500;
    }
    .novba-badge span {
      color: #ea580c;
      font-weight: 700;
    }
  </style>
</head>
<body>
  <div class="page">

    <!-- Header -->
    <div class="header">
      <div>
        <div class="business-name">${businessName}</div>
        ${businessEmail ? `<div class="business-email">${businessEmail}</div>` : ''}
      </div>
      <div class="proposal-label-block">
        <div class="proposal-label">Proposal</div>
        <div class="proposal-meta">
          ${proposal.proposalNumber}<br/>
          ${createdDate}
          ${validUntilFormatted ? `<br/>Valid until ${validUntilFormatted}` : ''}
        </div>
      </div>
    </div>

    <!-- Orange accent bar -->
    <div class="accent-bar"></div>

    <!-- Prepared for -->
    <div class="section">
      <div class="section-label">Prepared for</div>
      <div class="client-name">${proposal.client.companyName}</div>
      ${proposal.client.contactName ? `<div class="client-sub">${proposal.client.contactName}</div>` : ''}
      ${proposal.client.email ? `<div class="client-sub">${proposal.client.email}</div>` : ''}
    </div>

    <!-- Proposal title -->
    <div class="proposal-title">${proposal.title}</div>

    <!-- Scope of work -->
    ${
      proposal.scope
        ? `<div class="section">
      <div class="section-label">Scope of Work</div>
      <div class="section-body" style="margin-top: 6px;">${proposal.scope}</div>
    </div>`
        : ''
    }

    <!-- Pricing -->
    <div class="section">
      <div class="section-label">Pricing</div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th class="center">Qty</th>
              <th class="right">Rate</th>
              <th class="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${lineItemsHTML}
          </tbody>
        </table>
        <div class="total-row">
          <span class="total-label">Total</span>
          <span class="total-value">${formatCurrency(total)}</span>
        </div>
      </div>
    </div>

    <!-- Terms & conditions -->
    ${
      proposal.terms
        ? `<div class="section">
      <div class="section-label">Terms &amp; Conditions</div>
      <div class="section-body" style="margin-top: 6px;">${proposal.terms}</div>
    </div>`
        : ''
    }

    <!-- Footer -->
    <div class="footer">
      <div class="footer-left">
        ${validUntilFormatted ? `This proposal is valid until ${validUntilFormatted}` : 'Thank you for considering this proposal'}
      </div>
      <div class="novba-badge">Generated by <span>Novba</span> · ${businessName}</div>
    </div>

  </div>
</body>
</html>`;
}
