import { Client } from '@prisma/client';

/**
 * Format client data for response
 */
export function getClientData(client: Client) {
  return {
    id: client.id,
    companyName: client.companyName,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    billingAddress: client.billingAddress,
    paymentTerms: client.paymentTerms,
    currency: client.currency,
    notes: client.notes,
    createdAt: client.createdAt,
    updatedAt: client.updatedAt,
  };
}

/**
 * Convert clients to CSV format
 */
export function convertToCSV(clients: any[]): string {
  if (clients.length === 0) {
    return 'No clients to export';
  }

  // CSV Headers
  const headers = [
    'Company Name',
    'Contact Name',
    'Email',
    'Phone',
    'Payment Terms',
    'Currency',
    'Total Invoices',
    'Created At',
  ];

  // CSV Rows
  const rows = clients.map((client) => {
    return [
      escapeCsvValue(client.companyName),
      escapeCsvValue(client.contactName || ''),
      escapeCsvValue(client.email || ''),
      escapeCsvValue(client.phone || ''),
      client.paymentTerms,
      client.currency,
      client._count?.invoices || 0,
      new Date(client.createdAt).toLocaleDateString(),
    ];
  });

  // Combine headers and rows
  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Escape CSV values to handle commas, quotes, and newlines
 */
function escapeCsvValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
