import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
	EmailBody,
	ErrorBody,
	LoginBody,
	RefreshBody,
	RegisterBody,
	ResetBody,
	TokenPair,
	VerifyBody,
} from '@music-room/shared';
import { clientInfo } from '../../plugins/action-log.js';
import type { AuthService } from './service.js';

const tags = ['auth'];
const NoContent = z.null().describe('Done');
// Mail-sending routes: 5 per address per 15 minutes.
const mailLimit = { rateLimit: { max: 5, timeWindow: '15 minutes' } };

export const authRoutes =
	(auth: AuthService): FastifyPluginAsyncZod =>
	async (app) => {
		app.post(
			'/auth/register',
			{
				config: mailLimit,
				schema: {
					summary: 'Create an account and send the verification mail',
					description:
						'Always 204, also when the email is taken (the owner gets a mail instead).',
					tags,
					body: RegisterBody,
					response: { 204: NoContent, 400: ErrorBody, 429: ErrorBody },
				},
			},
			async (req, reply) => {
				await auth.register(req.body);
				return reply.code(204).send(null);
			},
		);

		app.post(
			'/auth/verify-email',
			{
				schema: {
					summary: 'Confirm an email with the token from the verification mail',
					tags,
					body: VerifyBody,
					response: { 204: NoContent, 400: ErrorBody },
				},
			},
			async (req, reply) => {
				await auth.verifyEmail(req.body.token);
				return reply.code(204).send(null);
			},
		);

		app.post(
			'/auth/resend-verification',
			{
				config: mailLimit,
				schema: {
					summary: 'Send the verification mail again',
					description: 'Always 204, whether or not the account exists.',
					tags,
					body: EmailBody,
					response: { 204: NoContent, 400: ErrorBody, 429: ErrorBody },
				},
			},
			async (req, reply) => {
				await auth.resendVerification(req.body.email);
				return reply.code(204).send(null);
			},
		);

		app.post(
			'/auth/login',
			{
				schema: {
					summary: 'Log in with email and password',
					description:
						'Registers the calling device from the X-Platform, X-Device and X-App-Version headers.',
					tags,
					body: LoginBody,
					response: { 200: TokenPair, 400: ErrorBody, 401: ErrorBody, 403: ErrorBody },
				},
			},
			async (req) => {
				const session = await auth.login(req.body, clientInfo(req));
				req.actor = session.actor;
				return session.tokens;
			},
		);

		app.post(
			'/auth/refresh',
			{
				schema: {
					summary: 'Exchange a refresh token for a new token pair',
					description:
						'The presented token is spent. Reusing a spent token revokes every token of that session.',
					tags,
					body: RefreshBody,
					response: { 200: TokenPair, 400: ErrorBody, 401: ErrorBody },
				},
			},
			async (req) => {
				const session = await auth.refresh(req.body.refreshToken);
				req.actor = session.actor;
				return session.tokens;
			},
		);

		app.post(
			'/auth/logout',
			{
				schema: {
					summary: 'Revoke the session of a refresh token',
					tags,
					body: RefreshBody,
					response: { 204: NoContent, 400: ErrorBody },
				},
			},
			async (req, reply) => {
				req.actor = await auth.logout(req.body.refreshToken);
				return reply.code(204).send(null);
			},
		);

		app.post(
			'/auth/forgot-password',
			{
				config: mailLimit,
				schema: {
					summary: 'Send a password reset mail',
					description: 'Always 204, whether or not the account exists.',
					tags,
					body: EmailBody,
					response: { 204: NoContent, 400: ErrorBody, 429: ErrorBody },
				},
			},
			async (req, reply) => {
				await auth.forgotPassword(req.body.email);
				return reply.code(204).send(null);
			},
		);

		app.post(
			'/auth/reset-password',
			{
				schema: {
					summary: 'Set a new password with the token from the reset mail',
					description: 'Logs every session of the account out.',
					tags,
					body: ResetBody,
					response: { 204: NoContent, 400: ErrorBody },
				},
			},
			async (req, reply) => {
				await auth.resetPassword(req.body.token, req.body.password);
				return reply.code(204).send(null);
			},
		);
	};
