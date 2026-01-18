/**
 * Helper function to get human-readable step name
 * Useful for frontend display
 */

function getStepName(step: number): string {
  const stepNames: Record<number, string> = {
    0: 'Not Started',
    1: 'Profile Setup',
    2: 'Business Information',
    3: 'Add First Client',
    4: 'Create First Invoice',
    5: 'Completed',
  };

  return stepNames[step] || 'Unknown';
}

export default getStepName;
