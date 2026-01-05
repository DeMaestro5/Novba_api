import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import { RoleRequest } from 'app-request';
import UserRepo from '../../database/repository/UserRepo';
import { BadRequestError } from '../../core/ApiError';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import bcrypt from 'bcrypt';
import _ from 'lodash';
import { RoleCode } from '../../database/types';
import role from '../../helpers/role';
import authorization from '../../auth/authorization';
import authentication from '../../auth/authentication';
import KeystoreRepo from '../../database/repository/KeystoreRepo';

const router = express.Router();

//----------------------------------------------------------------
router.use(authentication, role(RoleCode.ADMIN), authorization);
//----------------------------------------------------------------

router.post(
  '/user/assign',
  validator(schema.credential),
  asyncHandler(async (req: RoleRequest, res) => {
    const user = await UserRepo.findByEmail(req.body.email);
    if (!user) throw new BadRequestError('User do not exists');

    const passwordHash = await bcrypt.hash(req.body.password, 10);

    // UserRepo.updateInfo expects id (string) and data (Partial<User>)
    await UserRepo.updateInfo(user.id, {
      password: passwordHash,
    });

    // KeystoreRepo.removeAllForClient expects userId (string), not user object
    await KeystoreRepo.removeAllForClient(user.id);

    new SuccessResponse(
      'User password updated',
      _.pick(user, ['id', 'name', 'email']), // Use 'id' instead of '_id'
    ).send(res);
  }),
);

export default router;
