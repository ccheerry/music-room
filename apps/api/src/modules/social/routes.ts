import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
	ErrorBody,
	FacebookAuthBody,
	GoogleAuthBody,
	ProviderParams,
	TokenPair,
} from '@music-room/shared';
import { clientInfo } from '../../plugins/action-log.js';
import type { SocialService } from './service.js';

const NoContent = z.null().describe('Done');
const security = [{ bearerAuth: [] }];
const signInErrors = { 400: ErrorBody, 401: ErrorBody, 409: ErrorBody, 503: ErrorBody };
const linkErrors = { 400: ErrorBody, 401: ErrorBody, 409: ErrorBody, 503: ErrorBody };

export const socialRoutes =
	(social: SocialService): FastifyPluginAsyncZod =>
	async (app) => {
		app.post(
			'/auth/google',
			{
				schema: {
					summary: 'Log in or sign up with a Google id token',
					description:
						'409 ACCOUNT_EXISTS when the email already has an account: log in and link instead.',
					tags: ['auth'],
					body: GoogleAuthBody,
					response: { 200: TokenPair, ...signInErrors },
				},
			},
			async (req) => {
				const session = await social.signIn('google', req.body.idToken, clientInfo(req));
				req.actor = session.actor;
				return session.tokens;
			},
		);

		app.post(
			'/auth/facebook',
			{
				schema: {
					summary: 'Log in or sign up with a Facebook access token',
					description:
						'409 ACCOUNT_EXISTS when the email already has an account: log in and link instead.',
					tags: ['auth'],
					body: FacebookAuthBody,
					response: { 200: TokenPair, ...signInErrors },
				},
			},
			async (req) => {
				const session = await social.signIn(
					'facebook',
					req.body.accessToken,
					clientInfo(req),
				);
				req.actor = session.actor;
				return session.tokens;
			},
		);

		app.post(
			'/me/link/google',
			{
				preHandler: app.authenticate,
				schema: {
					summary: 'Link a Google account to the current user',
					tags: ['me'],
					security,
					body: GoogleAuthBody,
					response: { 204: NoContent, ...linkErrors },
				},
			},
			async (req, reply) => {
				await social.link(req.user.sub, 'google', req.body.idToken);
				return reply.code(204).send(null);
			},
		);

		app.post(
			'/me/link/facebook',
			{
				preHandler: app.authenticate,
				schema: {
					summary: 'Link a Facebook account to the current user',
					tags: ['me'],
					security,
					body: FacebookAuthBody,
					response: { 204: NoContent, ...linkErrors },
				},
			},
			async (req, reply) => {
				await social.link(req.user.sub, 'facebook', req.body.accessToken);
				return reply.code(204).send(null);
			},
		);

		app.delete(
			'/me/link/:provider',
			{
				preHandler: app.authenticate,
				schema: {
					summary: 'Unlink a provider',
					description: '409 LAST_LOGIN_METHOD when it is the only way to log in.',
					tags: ['me'],
					security,
					params: ProviderParams,
					response: {
						204: NoContent,
						400: ErrorBody,
						401: ErrorBody,
						404: ErrorBody,
						409: ErrorBody,
					},
				},
			},
			async (req, reply) => {
				await social.unlink(req.user.sub, req.params.provider);
				return reply.code(204).send(null);
			},
		);
	};
