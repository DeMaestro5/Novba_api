import express from 'express';
import { SuccessResponse } from '../../core/ApiResponse';
import UserRepo from '../../database/repository/UserRepo';
import { ProtectedRequest } from 'app-request';
import { BadRequestError } from '../../core/ApiError';
import validator from '../../helpers/validator';
import { getUserData } from '../auth/utils';
import schema from './schema';
import asyncHandler from '../../helpers/asyncHandler';
import _ from 'lodash';
import authentication from '../../auth/authentication';
import portfolioProfile from './portfolioProfile';

const router = express.Router();

/*-------------------------------------------------------------------------*/
router.use(authentication);
/*-------------------------------------------------------------------------*/

router.get(
  '/',
  asyncHandler(async (req: ProtectedRequest, res) => {
    const user = await UserRepo.findById(req.user.id);
    if (!user) throw new BadRequestError('User not found');

    const userData = await getUserData(user);

    return new SuccessResponse('Profile retrieved', {
      user: userData,
    }).send(res);
  }),
);

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

    return new SuccessResponse('success', {
      ..._.pick(user, [
        'name',
        'email',
        'profilePicUrl',
        'portfolioSlug',
        'portfolioTitle',
        'portfolioBio',
        'portfolioLocation',
        'isAvailable',
        'linkedinUrl',
        'twitterUrl',
        'githubUrl',
        'timezone',
        'dateFormat',
        'language',
      ]),
      roles,
    }).send(res);
  }),
);

router.put(
  '/',
  validator(schema.profile),
  asyncHandler(async (req: ProtectedRequest, res) => {
    const user = await UserRepo.findPrivateProfileById(req.user.id);
    if (!user) throw new BadRequestError('User not registered');

    console.log('[PUT /profile] req.body:', JSON.stringify(req.body, null, 2));
    // UserRepo.updateInfo expects id (string) and data (Partial<User>)
    // Only include fields that were actually sent in the request body
    const updateData = {
      ...(req.body.portfolioSlug !== undefined && {
        portfolioSlug: req.body.portfolioSlug || null,
      }),
      ...(req.body.portfolioTitle !== undefined && {
        portfolioTitle: req.body.portfolioTitle || null,
      }),
      ...(req.body.portfolioBio !== undefined && {
        portfolioBio: req.body.portfolioBio || null,
      }),
      ...(req.body.portfolioLocation !== undefined && {
        portfolioLocation: req.body.portfolioLocation || null,
      }),
      ...(req.body.isAvailable !== undefined && {
        isAvailable: req.body.isAvailable,
      }),
      ...(req.body.linkedinUrl !== undefined && {
        linkedinUrl: req.body.linkedinUrl || null,
      }),
      ...(req.body.twitterUrl !== undefined && {
        twitterUrl: req.body.twitterUrl || null,
      }),
      ...(req.body.githubUrl !== undefined && {
        githubUrl: req.body.githubUrl || null,
      }),
      ...(req.body.name !== undefined && { name: req.body.name || null }),
      ...(req.body.timezone !== undefined && {
        timezone: req.body.timezone || null,
      }),
      ...(req.body.dateFormat !== undefined && {
        dateFormat: req.body.dateFormat || null,
      }),
      ...(req.body.language !== undefined && {
        language: req.body.language || null,
      }),
      ...(req.body.profilePicUrl !== undefined && {
        profilePicUrl: req.body.profilePicUrl || null,
      }),
    };

    console.log(
      '[PUT /profile] updateData:',
      JSON.stringify(updateData, null, 2),
    );

    await UserRepo.updateInfo(user.id, updateData);

    console.log('[PUT /profile] update complete');

    const data = _.pick({ ...user, ...updateData }, [
      'name',
      'profilePicUrl',
      'portfolioSlug',
      'portfolioTitle',
      'portfolioBio',
      'portfolioLocation',
      'isAvailable',
      'linkedinUrl',
      'twitterUrl',
      'githubUrl',
      'timezone',
      'dateFormat',
      'language',
    ]);

    return new SuccessResponse('Profile updated', data).send(res);
  }),
);

router.use('/', portfolioProfile);

export default router;
