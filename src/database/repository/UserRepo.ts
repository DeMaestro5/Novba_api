import prisma from '../index';
import {
  User,
  Prisma,
  SubscriptionTier,
  SubscriptionStatus,
} from '@prisma/client';
import { UserWithRoles, CreateUserData, UpdateUserData } from '../types';

/**
 * Check if user exists by ID
 */
async function exists(id: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: {
      id,
      status: true,
    },
  });
  return user !== null;
}

/**
 * Find user by ID with roles
 */
async function findById(id: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({
    where: { id, status: true },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

/**
 * Find user by email with roles
 */
async function findByEmail(email: string): Promise<UserWithRoles | null> {
  return prisma.user.findFirst({
    where: {
      email,
      status: true,
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

/**
 * Find user by email and reset token (for password reset)
 */
async function findByEmailAndResetToken(
  email: string,
  token: string,
): Promise<UserWithRoles | null> {
  return prisma.user.findFirst({
    where: {
      email,
      passwordResetToken: token,
      status: true,
      passwordResetExpires: {
        gte: new Date(), // Token must not be expired
      },
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

/**
 * Find user by email verification token
 */
async function findByEmailVerificationToken(
  token: string,
): Promise<UserWithRoles | null> {
  return prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      status: true,
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

/**
 * Create new user with role
 */
async function create(
  userData: CreateUserData,
  roleCode: string,
): Promise<UserWithRoles> {
  // Find the role
  const role = await prisma.role.findUnique({
    where: { code: roleCode },
  });

  if (!role) throw new Error(`Role '${roleCode}' not found`);

  // Create user with role
  return prisma.user.create({
    data: {
      name: userData.name,
      firstName: userData.firstName,
      lastName: userData.lastName,
      email: userData.email,
      password: userData.password,
      profilePicUrl: userData.profilePicUrl,
      phone: userData.phone,
      businessName: userData.businessName,
      roles: {
        create: {
          roleId: role.id,
        },
      },
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

/**
 * Get user's private profile (includes all sensitive data)
 */
async function findPrivateProfileById(
  id: string,
): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({
    where: { id, status: true },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });
}

/**
 * Update user information
 */
async function updateInfo(id: string, data: UpdateUserData): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

/**
 * Update user password
 */
async function updatePassword(
  id: string,
  hashedPassword: string,
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Set password reset token
 */
async function setPasswordResetToken(
  email: string,
  token: string,
  expiresAt: Date,
): Promise<User> {
  return prisma.user.update({
    where: { email },
    data: {
      passwordResetToken: token,
      passwordResetExpires: expiresAt,
      updatedAt: new Date(),
    },
  });
}

/**
 * Set email verification token
 */
async function setEmailVerificationToken(
  email: string,
  token: string,
): Promise<User> {
  return prisma.user.update({
    where: { email },
    data: {
      emailVerificationToken: token,
      updatedAt: new Date(),
    },
  });
}

/**
 * Verify user email
 */
async function verifyEmail(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      verified: true,
      emailVerificationToken: null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Update last login timestamp
 */
async function updateLastLogin(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/**
 * Update onboarding progress
 */
async function updateOnboarding(
  id: string,
  step: number,
  completed?: boolean,
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      onboardingStep: step,
      onboardingCompleted: completed ?? undefined,
      updatedAt: new Date(),
    },
  });
}

/**
 * Update subscription tier and status
 */
async function updateSubscription(
  id: string,
  tier: SubscriptionTier,
  status: SubscriptionStatus,
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      subscriptionTier: tier,
      subscriptionStatus: status,
      updatedAt: new Date(),
    },
  });
}

/**
 * Update Stripe customer ID
 */
async function updateStripeCustomerId(
  id: string,
  stripeCustomerId: string,
): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      stripeCustomerId,
      updatedAt: new Date(),
    },
  });
}

/**
 * Soft delete user (set status to false)
 */
async function softDelete(id: string): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      status: false,
      updatedAt: new Date(),
    },
  });
}

/**
 * Count total users (for admin/stats)
 */
async function count(filters?: Prisma.UserWhereInput): Promise<number> {
  return prisma.user.count({
    where: {
      status: true,
      ...filters,
    },
  });
}

/**
 * Get users with pagination (for admin)
 */
async function findMany(
  skip: number = 0,
  take: number = 20,
  filters?: Prisma.UserWhereInput,
): Promise<User[]> {
  return prisma.user.findMany({
    where: {
      status: true,
      ...filters,
    },
    skip,
    take,
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export default {
  exists,
  findById,
  findByEmail,
  findByEmailAndResetToken,
  findByEmailVerificationToken,
  create,
  findPrivateProfileById,
  updateInfo,
  updatePassword,
  setPasswordResetToken,
  setEmailVerificationToken,
  verifyEmail,
  updateLastLogin,
  updateOnboarding,
  updateSubscription,
  updateStripeCustomerId,
  softDelete,
  count,
  findMany,
};
