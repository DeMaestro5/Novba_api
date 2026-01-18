export const ONBOARDING_STEPS = {
  NOT_STARTED: 0,
  PROFILE_SETUP: 1,
  BUSINESS_INFO: 2,
  FIRST_CLIENT: 3,
  FIRST_INVOICE: 4,
  COMPLETED: 5, // When onboarding is fully done
} as const;

export const TOTAL_ONBOARDING_STEPS = 4; // Steps 1-4

/**
 * Get the next step number after the current one
 * Returns null if already at the last step
 */
export function getNextStep(currentStep: number): number | null {
  if (currentStep >= TOTAL_ONBOARDING_STEPS) {
    return null; // Already at or past the last step
  }
  return currentStep + 1;
}

/**
 * Check if a step number is valid
 */
export function isValidStep(step: number): boolean {
  return (
    step >= ONBOARDING_STEPS.NOT_STARTED && step <= ONBOARDING_STEPS.COMPLETED
  );
}

/**
 * Check if onboarding is completed
 */
export function isOnboardingCompleted(
  onboardingStep: number,
  onboardingCompleted: boolean,
): boolean {
  return onboardingCompleted || onboardingStep >= TOTAL_ONBOARDING_STEPS;
}
