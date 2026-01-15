import crypto from 'crypto';

export function generateVerificationToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateTokenExpiry(hours: number = 24): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + hours);
  return expiry;
}

export function isTokenExpired(expiryDate: Date | null): boolean {
  if (!expiryDate) return true;
  return new Date() > expiryDate;
}
