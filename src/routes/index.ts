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
import oauth from './auth/oauth';
import onboarding from './onboarding';
import clients from './clients';
import proposals from './proposals';
import contracts from './contracts';
import projects from './projects';
import invoices from './invoices';
import expenses from './expenses';
import payments from './payments';
import stripeWebhook from './webhooks/stripe';
import dashboard from './dashboard';
import pricing from './pricing';
import portfolio from './portfolio';
import publicPortfolioLink from './portfolio/public';
import uploadRoutes from './upload';
import settings from './settings';
import subscription from './subscription';
import stripeSubscriptionWebhook from './webhooks/stripe-subscription';
import publicRouter from './public';

const router = express.Router();

router.use('/webhooks', stripeWebhook);
router.use('/webhooks', stripeSubscriptionWebhook);

// OAuth routes are PUBLIC — mount BEFORE apikey (no API key required for redirects)
router.use('/auth/oauth', oauth);

// Public portfolio — unauthenticated, mount BEFORE apikey (GET /p/:slug)
router.use('/p', publicPortfolioLink);

// Public endpoints — no auth required
router.use('/public', publicRouter);

/*---------------------------------------------------------*/
router.use(apikey);
/*---------------------------------------------------------*/
/*---------------------------------------------------------*/
router.use(permission(Permission.GENERAL));
/*---------------------------------------------------------*/
router.use('/signup', signup);
router.use('/login', login);
router.use('/logout', logout);
router.use('/refresh', token);
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
router.use('/invoices', invoices);
router.use('/expenses', expenses);
router.use('/payments', payments);
router.use('/dashboard', dashboard);
router.use('/pricing', pricing);
router.use('/portfolio', portfolio);
router.use('/upload', uploadRoutes);
router.use('/settings', settings);
router.use('/subscription', subscription);

export default router;
