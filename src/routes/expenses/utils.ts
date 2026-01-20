import { Expense } from '@prisma/client';

/**
 * Format expense data for response
 */
export function getExpenseData(expense: Expense) {
  return {
    id: expense.id,
    date: expense.date,
    vendor: expense.vendor,
    amount: expense.amount,
    currency: expense.currency,
    category: expense.category,
    description: expense.description,
    taxDeductible: expense.taxDeductible,
    receiptUrl: expense.receiptUrl,
    createdAt: expense.createdAt,
    updatedAt: expense.updatedAt,
  };
}

/**
 * Convert expenses to CSV format
 */
export function convertToCSV(expenses: Expense[]): string {
  if (expenses.length === 0) {
    return 'No expenses to export';
  }

  // CSV Headers
  const headers = [
    'Date',
    'Vendor',
    'Category',
    'Amount',
    'Currency',
    'Tax Deductible',
    'Description',
    'Receipt',
  ];

  // CSV Rows
  const rows = expenses.map((expense) => {
    return [
      new Date(expense.date).toLocaleDateString(),
      escapeCsvValue(expense.vendor),
      expense.category,
      Number(expense.amount).toFixed(2),
      expense.currency,
      expense.taxDeductible ? 'Yes' : 'No',
      escapeCsvValue(expense.description || ''),
      expense.receiptUrl || '',
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

/**
 * Format category name for display
 */
export function formatCategoryName(category: string): string {
  return category
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Calculate total expenses
 */
export function calculateTotals(expenses: Expense[]): {
  total: number;
  taxDeductible: number;
  nonTaxDeductible: number;
  count: number;
} {
  const total = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
  const taxDeductible = expenses
    .filter((exp) => exp.taxDeductible)
    .reduce((sum, exp) => sum + Number(exp.amount), 0);
  const nonTaxDeductible = total - taxDeductible;

  return {
    total: Math.round(total * 100) / 100,
    taxDeductible: Math.round(taxDeductible * 100) / 100,
    nonTaxDeductible: Math.round(nonTaxDeductible * 100) / 100,
    count: expenses.length,
  };
}

/**
 * Mock OCR receipt scanning (placeholder for AI integration)
 */
export function mockReceiptScan(receiptImageBase64: string): {
  vendor: string;
  amount: number;
  date: string;
  category: string;
  confidence: number;
} {
  console.log('Receipt ImageBase64',receiptImageBase64)
  // In production, this would call Google Cloud Vision API, AWS Textract, or similar
  // For now, return mock data
  return {
    vendor: 'Extracted Vendor Name',
    amount: 99.99,
    date: new Date().toISOString().split('T')[0],
    category: 'OTHER',
    confidence: 0.85,
  };
}