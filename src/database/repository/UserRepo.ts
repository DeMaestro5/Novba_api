import prisma from '../index';
import { User, Role } from '@prisma/client';

// Type for User with roles
type UserWithRoles = User & { roles: { role: Role }[] };

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

async function findByEmail(email: string): Promise<UserWithRoles | null> {
  return prisma.user.findUnique({
    where: { email },
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
  },
  roleCode: string,
): Promise<User> {
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

async function updateInfo(id: string, data: Partial<User>): Promise<User> {
  return prisma.user.update({
    where: { id },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

export default {
  exists,
  findById,
  findByEmail,
  create,
  updateInfo,
};
