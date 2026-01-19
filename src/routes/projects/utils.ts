import { Project } from '@prisma/client';
import { ProjectWithDetails } from '../../database/repository/ProjectRepo';

/**
 * Format project data for response
 */
export function getProjectData(project: ProjectWithDetails | Project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    endDate: project.endDate,
    totalBudget: project.totalBudget,
    currency: project.currency,
    paymentPlan: project.paymentPlan,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    // Include relations if present
    ...('client' in project && { client: project.client }),
    ...('proposal' in project && { proposal: project.proposal }),
    ...('contract' in project && { contract: project.contract }),
    ...('invoices' in project && { invoices: project.invoices }),
    ...('_count' in project && { invoiceCount: project._count?.invoices }),
  };
}

/**
 * Calculate project progress
 */
export function calculateProgress(
  totalBudget: number,
  totalInvoiced: number,
): number {
  if (totalBudget === 0) return 0;
  return Math.round((totalInvoiced / totalBudget) * 100);
}

/**
 * Validate payment plan totals
 */
export function validatePaymentPlan(
  paymentPlan: any[],
  totalBudget: number,
): { valid: boolean; message?: string } {
  const totalPlanAmount = paymentPlan.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  if (Math.abs(totalPlanAmount - totalBudget) > 0.01) {
    return {
      valid: false,
      message: `Payment plan total ($${totalPlanAmount}) does not match project budget ($${totalBudget})`,
    };
  }

  return { valid: true };
}

/**
 * Generate payment plan template
 */
export function generatePaymentPlanTemplate(
  totalBudget: number,
  milestones: number = 3,
): any[] {
  const amountPerMilestone = totalBudget / milestones;

  const template = [];
  for (let i = 1; i <= milestones; i++) {
    template.push({
      milestone: `Milestone ${i}`,
      amount: amountPerMilestone,
      status: 'pending',
    });
  }

  return template;
}
