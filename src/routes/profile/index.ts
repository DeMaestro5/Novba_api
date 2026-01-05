import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import UserRepo from '../../database/repository/UserRepo';
import { ProtectedRequest } from 'app-request';
import { BadRequestError } from '../../core/ApiError';
import validator from '../../helpers/validator';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import _ from 'lodash';
import authentication from '../../auth/authentication';

const router = express.Router();

/*-------------------------------------------------------------------------*/
router.use(authentication);
/*-------------------------------------------------------------------------*/

router.get(
  '/my',
  asyncHandler(async (req: ProtectedRequest, res) => {
    // Use req.user.id (string UUID) instead of req.user._id
    const user = await UserRepo.findPrivateProfileById(req.user.id);
    if (!user) throw new BadRequestError('User not registered');

    // Map roles to simpler structure
    const roles = user.roles.map((ur) => ({
      id: ur.role.id,
      code: ur.role.code,
    }));

    return new SuccessResponse(
      'success',
      {
        ..._.pick(user, ['name', 'email', 'profilePicUrl']),
        roles,
      },
    ).send(res);
  }),
);

router.put(
  '/',
  validator(schema.profile),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const user = await UserRepo.findPrivateProfileById(req.user.id);
    if (!user) throw new BadRequestError('User not registered');

    // UserRepo.updateInfo expects id (string) and data (Partial<User>)
    const updateData: any = {};
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.profilePicUrl) updateData.profilePicUrl = req.body.profilePicUrl;

    await UserRepo.updateInfo(user.id, updateData);

    const data = _.pick({ ...user, ...updateData }, ['name', 'profilePicUrl']);

    return new SuccessResponse('Profile updated', data).send(res);
  }),
);

export default router;
