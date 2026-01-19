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
  const lineItemsHTML = proposal.lineItems
    .map(
      (item: any) => `
    <tr>
      <td>${item.description}</td>
      <td style="text-align: center;">${item.quantity}</td>
      <td style="text-align: right;">${proposal.currency} ${Number(
        item.rate,
      ).toFixed(2)}</td>
      <td style="text-align: right;">${proposal.currency} ${Number(
        item.amount,
      ).toFixed(2)}</td>
    </tr>
  `,
    )
    .join('');

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
        .proposal-info {
          text-align: right;
        }
        .proposal-title {
          font-size: 28px;
          font-weight: bold;
          color: #4F46E5;
          margin-bottom: 10px;
        }
        .client-section {
          margin-bottom: 30px;
        }
        .section-title {
          font-size: 18px;
          font-weight: bold;
          margin-bottom: 15px;
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
        .total-section {
          text-align: right;
          margin-top: 20px;
          font-size: 20px;
          font-weight: bold;
        }
        .scope-section, .terms-section {
          margin: 30px 0;
          line-height: 1.6;
        }
        .footer {
          margin-top: 50px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          color: #666;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="business-info">
          <h1>${user.businessName || user.name}</h1>
          ${user.email ? `<p>${user.email}</p>` : ''}
          ${user.phone ? `<p>${user.phone}</p>` : ''}
          ${user.website ? `<p>${user.website}</p>` : ''}
        </div>
        <div class="proposal-info">
          <div class="proposal-title">PROPOSAL</div>
          <p><strong>Number:</strong> ${proposal.proposalNumber}</p>
          <p><strong>Date:</strong> ${new Date(
            proposal.createdAt,
          ).toLocaleDateString()}</p>
          ${
            proposal.validUntil
              ? `<p><strong>Valid Until:</strong> ${new Date(
                  proposal.validUntil,
                ).toLocaleDateString()}</p>`
              : ''
          }
        </div>
      </div>

      <div class="client-section">
        <div class="section-title">Prepared For:</div>
        <p><strong>${proposal.client.companyName}</strong></p>
        ${
          proposal.client.contactName
            ? `<p>${proposal.client.contactName}</p>`
            : ''
        }
        ${proposal.client.email ? `<p>${proposal.client.email}</p>` : ''}
      </div>

      <div class="section-title">${proposal.title}</div>

      ${
        proposal.scope
          ? `
      <div class="scope-section">
        <div class="section-title">Scope of Work</div>
        <p>${proposal.scope}</p>
      </div>
      `
          : ''
      }

      <div class="section-title">Pricing Breakdown</div>
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

      <div class="total-section">
        <strong>Total: ${proposal.currency} ${Number(
          proposal.totalAmount,
        ).toFixed(2)}</strong>
      </div>

      ${
        proposal.terms
          ? `
      <div class="terms-section">
        <div class="section-title">Terms & Conditions</div>
        <p>${proposal.terms}</p>
      </div>
      `
          : ''
      }

      <div class="footer">
        <p>This proposal is valid until ${
          proposal.validUntil
            ? new Date(proposal.validUntil).toLocaleDateString()
            : 'acceptance'
        }</p>
        <p>Thank you for considering our proposal!</p>
      </div>
    </body>
    </html>
  `;
}
