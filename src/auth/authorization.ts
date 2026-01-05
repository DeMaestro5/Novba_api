import express from 'express';
import { ProtectedRequest } from 'app-request';
import { AuthFailureError } from '../core/ApiError';
import RoleRepo from '../database/repository/RoleRepo';
import asyncHandler from '../helpers/asyncHandler';

const router = express.Router();

export default router.use(
  asyncHandler(async (req: ProtectedRequest, res, next) => {
    if (!req.user || !req.user.roles || !req.currentRoleCodes)
      throw new AuthFailureError('Permission denied');

    const roles = await RoleRepo.findByCodes(req.currentRoleCodes);
    if (roles.length === 0) throw new AuthFailureError('Permission denied');

    let authorized = false;

    // In Prisma, req.user.roles is UserRole[] with nested role objects
    // Structure: { role: { id, code, ... } }[]
    for (const userRole of req.user.roles) {
      if (authorized) break;
      for (const role of roles) {
        // Compare role codes or role IDs (both are strings in Prisma)
        if (userRole.role.code === role.code || userRole.role.id === role.id) {
          authorized = true;
          break;
        }
      }
    }

    if (!authorized) throw new AuthFailureError('Permission denied');

    return next();
  }),
);
