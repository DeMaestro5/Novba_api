/**
 * Get payment terms for display/invoice generation
 */
export function getPaymentTermsForDisplay(
  paymentTerms: string,
  customTerms?: string | null,
): string {
  if (paymentTerms === 'CUSTOM' && customTerms) {
    return customTerms;
  }

  const termMap: Record<string, string> = {
    NET_15: 'Net 15',
    NET_30: 'Net 30',
    NET_60: 'Net 60',
    DUE_ON_RECEIPT: 'Due on Receipt',
  };

  return termMap[paymentTerms] || paymentTerms;
}

/**
 * Get payment terms for API response
 */
export function formatPaymentTerms(paymentTerms: string, customTerms?: string | null) {
  return {
    type: paymentTerms,
    custom: customTerms,
    display: getPaymentTermsForDisplay(paymentTerms, customTerms),
  };
}