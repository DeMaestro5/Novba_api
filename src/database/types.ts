import { User, Role, UserRole, Client, PaymentTerms } from '@prisma/client';

// ============================================
// ENUMS (Existing - Keep these!)
// ============================================

export enum RoleCode {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

export enum Permission {
  GENERAL = 'GENERAL',
}

// ============================================
// USER TYPES
// ============================================

// Type for User with roles (used throughout the app)
// Updated to match Prisma's actual return type
export type UserWithRoles = User & {
  roles: (UserRole & {
    role: Role;
  })[];
};

// User creation data
export type CreateUserData = {
  name?: string;
  firstName?: string;
  lastName?: string;
  email: string;
  password: string;
  profilePicUrl?: string;
  phone?: string;
  businessName?: string;
};

// User update data
export type UpdateUserData = {
  name?: string;
  firstName?: string;
  lastName?: string;
  profilePicUrl?: string;
  phone?: string;
  businessName?: string;
  logoUrl?: string;
  address?: any; // JSON type
  website?: string;
  taxId?: string;
  defaultCurrency?: string;
  defaultPaymentTerms?: PaymentTerms;
  defaultTaxRate?: number;
  verified?: boolean;
  emailVerificationToken?: string | null;
  passwordResetToken?: string | null;
  passwordResetExpires?: Date | null;
  password?: string;
  lastLoginAt?: Date;
  onboardingCompleted?: boolean;
  onboardingStep?: number;
  averageHourlyRate?: number;
  industry?: string;
  experienceLevel?: string;
};

// ============================================
// CLIENT TYPES
// ============================================

// Client with user included (for when we need it)
export type ClientWithUser = Client & {
  user: User;
};

// Client creation data
export type CreateClientData = {
  companyName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  billingAddress?: any; // JSON type
  paymentTerms?: 'NET_15' | 'NET_30' | 'NET_60' | 'DUE_ON_RECEIPT';
  currency?: string;
  notes?: string;
};

// Client update data
export type UpdateClientData = {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  billingAddress?: any; // JSON type
  paymentTerms?: 'NET_15' | 'NET_30' | 'NET_60' | 'DUE_ON_RECEIPT';
  currency?: string;
  notes?: string;
};

// ============================================
// INVOICE TYPES (For future use)
// ============================================

// Invoice line item data
export type InvoiceLineItemData = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  order: number;
};

// Invoice creation data
export type CreateInvoiceData = {
  clientId: string;
  issueDate: Date;
  dueDate: Date;
  lineItems: InvoiceLineItemData[];
  taxRate?: number;
  notes?: string;
  terms?: string;
};
