// Re-export Prisma Role type and RoleCode enum
// This file exists for backward compatibility with imports
// All new code should import Role from '@prisma/client' and RoleCode from '../types'
export { Role } from '@prisma/client';
export { RoleCode } from '../types';
