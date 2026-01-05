import prisma from '../index';
import { User } from '@prisma/client';
import { UserWithRoles } from '../types';

async function exists(id: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: {
      id,
      status: true,
    },
  });
  return user !== null;
}

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

// Find user by email and reset token (for password reset)
async function findByEmailAndResetToken(
  email: string,
  token: string,
): Promise<UserWithRoles | null> {
  return prisma.user.findFirst({
    where: {
      email,
      passwordResetToken: token,
      status: true,
      // Optional: Add token expiry check here too
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

// Also update your existing findByEmail to use findFirst
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

async function create(
  userData: {
    name?: string;
    email: string;
    password: string;
    profilePicUrl?: string;
  },
  roleCode: string,
): Promise<UserWithRoles> {
  // find the role
  const role = await prisma.role.findUnique({
    where: { code: roleCode },
  });

  if (!role) throw new Error('Role not found');

  // Create user with role
  return prisma.user.create({
    data: {
      name: userData.name,
      email: userData.email,
      password: userData.password,
      profilePicUrl: userData.profilePicUrl,
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

async function updateInfo(id: string, data: Partial<User>): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      ...data,
      address: data.address ? JSON.stringify(data.address) : undefined,
      updatedAt: new Date(),
    },
  });
}

export default {
  exists,
  findById,
  findByEmail,
  findByEmailAndResetToken,
  findPrivateProfileById,
  create,
  updateInfo,
};
