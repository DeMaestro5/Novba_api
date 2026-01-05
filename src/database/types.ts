import { User, Role } from '@prisma/client';

// Type for User with roles (used throughout the app)
export type UserWithRoles = User & { roles: { role: Role }[] };

// Role codes enum (moved from model/Role.ts)
export enum RoleCode {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

// Permission enum (moved from model/ApiKey.ts)
export enum Permission {
  GENERAL = 'GENERAL',
}
