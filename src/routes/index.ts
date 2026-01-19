import express from 'express';
import apikey from '../auth/apikey';
import permission from '../helpers/permission';
import { Permission } from '../database/types';
import signup from './auth/signup';
import login from './auth/login';
import logout from './auth/logout';
import token from './auth/token';
import credential from './auth/credential';
import profile from './profile';
import forgotPassword from './auth/forgot-password';
import resetPassword from './auth/reset-password';
import emailVerification from './auth/emailVerification';
import onboarding from './onboarding';
import clients from './clients';
import proposals from './proposals';
import contracts from './contracts';
import projects from './projects';

const router = express.Router();

/*---------------------------------------------------------*/
router.use(apikey);
/*---------------------------------------------------------*/
/*---------------------------------------------------------*/
router.use(permission(Permission.GENERAL));
/*---------------------------------------------------------*/
router.use('/signup', signup);
router.use('/login', login);
router.use('/logout', logout);
router.use('/token', token);
router.use('/credential', credential);
router.use('/profile', profile);
router.use('/', emailVerification);
router.use('/forgot-password', forgotPassword);
router.use('/reset-password', resetPassword);
router.use('/onboarding', onboarding);
router.use('/clients', clients);
router.use('/proposals', proposals);
router.use('/contracts', contracts);
router.use('/projects', projects);

export default router;
