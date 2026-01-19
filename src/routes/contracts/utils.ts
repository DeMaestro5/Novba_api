import { Contract } from '@prisma/client';
import { ContractWithDetails } from '../../database/repository/ContractRepo';

/**
 * Format contract data for response
 */
export function getContractData(contract: ContractWithDetails | Contract) {
  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    title: contract.title,
    status: contract.status,
    templateType: contract.templateType,
    content: contract.content,
    terms: contract.terms,
    signedAt: contract.signedAt,
    signatureUrl: contract.signatureUrl,
    startDate: contract.startDate,
    endDate: contract.endDate,
    pdfUrl: contract.pdfUrl,
    createdAt: contract.createdAt,
    updatedAt: contract.updatedAt,
    // Include relations if present
    ...('client' in contract && { client: contract.client }),
    ...('proposal' in contract && { proposal: contract.proposal }),
  };
}

/**
 * Contract templates with pre-filled content
 */
export const contractTemplates = {
  service_agreement: {
    name: 'Service Agreement',
    description: 'Standard service agreement for freelance work',
    content: `SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of [START_DATE] between:

SERVICE PROVIDER:
[PROVIDER_NAME]
[PROVIDER_ADDRESS]

CLIENT:
[CLIENT_NAME]
[CLIENT_ADDRESS]

1. SERVICES
The Service Provider agrees to provide the following services:
[SCOPE_OF_WORK]

2. COMPENSATION
The Client agrees to pay the Service Provider:
Total Amount: [AMOUNT] [CURRENCY]
Payment Terms: [PAYMENT_TERMS]

3. TERM
This Agreement shall commence on [START_DATE] and continue until [END_DATE] or completion of services.

4. DELIVERABLES
[DELIVERABLES_LIST]

5. INTELLECTUAL PROPERTY
All work product created under this Agreement shall be owned by the Client upon full payment.

6. CONFIDENTIALITY
Both parties agree to maintain confidentiality of proprietary information.

7. TERMINATION
Either party may terminate this Agreement with [NOTICE_PERIOD] written notice.

8. GENERAL PROVISIONS
This Agreement constitutes the entire agreement between the parties.

SIGNATURES:

Service Provider: _________________ Date: _______
Client: _________________ Date: _______`,
  },

  nda: {
    name: 'Non-Disclosure Agreement',
    description: 'Standard NDA to protect confidential information',
    content: `NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of [START_DATE] between:

DISCLOSING PARTY:
[PROVIDER_NAME]
[PROVIDER_ADDRESS]

RECEIVING PARTY:
[CLIENT_NAME]
[CLIENT_ADDRESS]

1. CONFIDENTIAL INFORMATION
"Confidential Information" means any information disclosed by either party that is marked as confidential or should reasonably be considered confidential.

2. OBLIGATIONS
The Receiving Party agrees to:
- Maintain confidentiality of all Confidential Information
- Use Confidential Information only for the Purpose
- Not disclose to third parties without prior written consent

3. TERM
This Agreement shall remain in effect for [DURATION] from the date of disclosure.

4. EXCLUSIONS
This Agreement does not apply to information that:
- Is publicly available
- Was known prior to disclosure
- Is independently developed
- Is rightfully received from a third party

5. RETURN OF MATERIALS
Upon termination, all Confidential Information must be returned or destroyed.

SIGNATURES:

Disclosing Party: _________________ Date: _______
Receiving Party: _________________ Date: _______`,
  },

  sow: {
    name: 'Statement of Work',
    description: 'Detailed project scope and deliverables',
    content: `STATEMENT OF WORK

Project: [PROJECT_TITLE]
Date: [START_DATE]

PARTIES:
Service Provider: [PROVIDER_NAME]
Client: [CLIENT_NAME]

1. PROJECT OVERVIEW
[PROJECT_DESCRIPTION]

2. SCOPE OF WORK
[DETAILED_SCOPE]

3. DELIVERABLES
[DELIVERABLES_LIST]

4. TIMELINE
[PROJECT_TIMELINE]

5. PAYMENT SCHEDULE
Total Project Cost: [AMOUNT] [CURRENCY]
[PAYMENT_MILESTONES]

6. ACCEPTANCE CRITERIA
[ACCEPTANCE_CRITERIA]

7. ASSUMPTIONS
[PROJECT_ASSUMPTIONS]

8. EXCLUSIONS
[OUT_OF_SCOPE_ITEMS]

9. CHANGE MANAGEMENT
Any changes to this SOW must be documented and approved by both parties in writing.

APPROVED BY:

Service Provider: _________________ Date: _______
Client: _________________ Date: _______`,
  },

  freelance: {
    name: 'Freelance Contract',
    description: 'Simple freelance work agreement',
    content: `FREELANCE CONTRACT

This Freelance Contract is entered into on [START_DATE] between:

FREELANCER:
[PROVIDER_NAME]
Email: [PROVIDER_EMAIL]
Phone: [PROVIDER_PHONE]

CLIENT:
[CLIENT_NAME]
Email: [CLIENT_EMAIL]

1. PROJECT DESCRIPTION
[PROJECT_DESCRIPTION]

2. SCOPE OF WORK
[SCOPE_DETAILS]

3. COMPENSATION
Rate: [HOURLY_RATE] per hour OR Fixed Fee: [FIXED_AMOUNT]
Estimated Hours: [ESTIMATED_HOURS]
Total Estimated Cost: [TOTAL_COST]

4. PAYMENT TERMS
[PAYMENT_TERMS]

5. DEADLINE
Project completion date: [END_DATE]

6. REVISIONS
Includes [NUMBER] rounds of revisions. Additional revisions at [REVISION_RATE].

7. COPYRIGHT
Work product becomes Client property upon full payment.

8. KILL FEE
If project is cancelled, [KILL_FEE_PERCENTAGE]% of total fee is due.

AGREED:

Freelancer: _________________ Date: _______
Client: _________________ Date: _______`,
  },

  consulting: {
    name: 'Consulting Agreement',
    description: 'Professional consulting services agreement',
    content: `CONSULTING AGREEMENT

This Consulting Agreement ("Agreement") is made as of [START_DATE] between:

CONSULTANT:
[PROVIDER_NAME]
[PROVIDER_ADDRESS]

CLIENT:
[CLIENT_NAME]
[CLIENT_ADDRESS]

1. CONSULTING SERVICES
The Consultant agrees to provide the following services:
[SERVICES_DESCRIPTION]

2. COMPENSATION
Hourly Rate: [HOURLY_RATE]
OR
Monthly Retainer: [MONTHLY_AMOUNT]
Estimated Hours: [ESTIMATED_HOURS]

3. TERM
This Agreement is effective from [START_DATE] to [END_DATE].

4. INDEPENDENT CONTRACTOR
The Consultant is an independent contractor, not an employee.

5. EXPENSES
Client shall reimburse pre-approved expenses.

6. CONFIDENTIALITY
Consultant agrees to maintain confidentiality of Client information.

7. NON-COMPETE
[NON_COMPETE_CLAUSE]

8. TERMINATION
Either party may terminate with [NOTICE_PERIOD] days written notice.

SIGNATURES:

Consultant: _________________ Date: _______
Client: _________________ Date: _______`,
  },
};

/**
 * Generate contract HTML for PDF
 */
export function generateContractHTML(
  contract: ContractWithDetails,
  user: any,
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: 'Times New Roman', serif;
          margin: 60px;
          color: #000;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        .contract-title {
          font-size: 24px;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .contract-number {
          font-size: 14px;
          color: #666;
        }
        .parties {
          margin: 30px 0;
        }
        .party {
          margin-bottom: 20px;
        }
        .party-label {
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .content {
          margin: 30px 0;
          white-space: pre-wrap;
        }
        .signature-section {
          margin-top: 60px;
          page-break-inside: avoid;
        }
        .signature-block {
          margin-top: 40px;
        }
        .signature-line {
          border-top: 1px solid #000;
          width: 300px;
          margin-top: 60px;
          display: inline-block;
        }
        .footer {
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          text-align: center;
          font-size: 12px;
          color: #666;
        }
        .status-badge {
          display: inline-block;
          padding: 5px 15px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          margin-top: 10px;
        }
        .status-draft { background: #f3f4f6; color: #374151; }
        .status-sent { background: #dbeafe; color: #1e40af; }
        .status-signed { background: #d1fae5; color: #065f46; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="contract-title">${contract.title}</div>
        <div class="contract-number">Contract #${contract.contractNumber}</div>
        <div class="status-badge status-${contract.status.toLowerCase()}">
          ${contract.status}
        </div>
      </div>

      <div class="parties">
        <div class="party">
          <div class="party-label">Service Provider:</div>
          <div>${user.businessName || user.name}</div>
          ${user.email ? `<div>${user.email}</div>` : ''}
          ${user.phone ? `<div>${user.phone}</div>` : ''}
          ${user.address ? `<div>${JSON.stringify(user.address)}</div>` : ''}
        </div>

        <div class="party">
          <div class="party-label">Client:</div>
          <div>${contract.client.companyName}</div>
          ${
            contract.client.contactName
              ? `<div>${contract.client.contactName}</div>`
              : ''
          }
          ${contract.client.email ? `<div>${contract.client.email}</div>` : ''}
        </div>
      </div>

      ${
        contract.startDate || contract.endDate
          ? `
      <div style="margin: 20px 0;">
        ${
          contract.startDate
            ? `<div><strong>Start Date:</strong> ${new Date(
                contract.startDate,
              ).toLocaleDateString()}</div>`
            : ''
        }
        ${
          contract.endDate
            ? `<div><strong>End Date:</strong> ${new Date(
                contract.endDate,
              ).toLocaleDateString()}</div>`
            : ''
        }
      </div>
      `
          : ''
      }

      <div class="content">
${contract.content}
      </div>

      ${
        contract.signedAt
          ? `
      <div style="margin-top: 40px; padding: 20px; background: #f9fafb; border-left: 4px solid #10b981;">
        <strong>✓ Signed on ${new Date(
          contract.signedAt,
        ).toLocaleDateString()}</strong>
        ${
          contract.signatureUrl
            ? `<div style="margin-top: 10px;"><img src="${contract.signatureUrl}" alt="Signature" style="max-width: 200px;"></div>`
            : ''
        }
      </div>
      `
          : `
      <div class="signature-section">
        <div class="signature-block">
          <div><strong>Service Provider:</strong></div>
          <div class="signature-line"></div>
          <div style="margin-top: 10px;">Signature / Date</div>
        </div>

        <div class="signature-block">
          <div><strong>Client:</strong></div>
          <div class="signature-line"></div>
          <div style="margin-top: 10px;">Signature / Date</div>
        </div>
      </div>
      `
      }

      <div class="footer">
        <p>Contract generated on ${new Date().toLocaleDateString()}</p>
        ${
          contract.proposal
            ? `<p>Based on Proposal #${contract.proposal.proposalNumber}</p>`
            : ''
        }
      </div>
    </body>
    </html>
  `;
}
