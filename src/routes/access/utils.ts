import { UserWithRoles } from '../../database/types';
import _ from 'lodash';

export const enum AccessMode {
  LOGIN = 'LOGIN',
  SIGNUP = 'SIGNUP',
}

export async function getUserData(user: UserWithRoles) {
  // Prisma user has 'id' instead of '_id'
  // Roles structure: { role: { id, code, ... } }[]
  // Map roles to a simpler structure for API response
  const roles = user.roles.map((ur) => ({
    id: ur.role.id,
    code: ur.role.code,
  }));

  const data = {
    id: user.id, // Use 'id' instead of '_id'
    name: user.name,
    roles: roles,
    profilePicUrl: user.profilePicUrl,
  };
  return data;
}
