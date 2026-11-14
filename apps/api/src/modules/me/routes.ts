import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ChangePasswordBody, ErrorBody, MeResponse, UpdateMeBody } from '@music-room/shared';
import type { AuthService } from '../auth/service.js';
import type { UsersService } from '../users/service.js';

const tags = ['me'];
const security = [{ bearerAuth: [] }];

export const meRoutes =
	(auth: AuthService, users: UsersService): FastifyPluginAsyncZod =>
	async (app) => {
		app.addHook('onRequest', app.authenticate);

		app.get(
			'/me',
			{
				schema: {
					summary: 'Current user, every profile tier included',
					description:
						'Public, friends-only and private information, email, linked providers.',
					tags,
					security,
					response: { 200: MeResponse, 401: ErrorBody },
				},
			},
			async (req) => users.me(req.user.sub),
		);

		app.patch(
			'/me',
			{
				schema: {
					summary: 'Update the profile',
					description:
						'Each tier sent replaces the stored one. publicInfo: everyone, friendsInfo: accepted friends, privateInfo: only you.',
					tags,
					security,
					body: UpdateMeBody,
					response: { 200: MeResponse, 400: ErrorBody, 401: ErrorBody },
				},
			},
			async (req) => users.updateMe(req.user.sub, req.body),
		);

		app.put(
			'/me/password',
			{
				schema: {
					summary: 'Change the password',
					description:
						'Needs the current password; 403 INVALID_CREDENTIALS when it is wrong.',
					tags,
					security,
					body: ChangePasswordBody,
					response: {
						204: z.null().describe('Done'),
						400: ErrorBody,
						401: ErrorBody,
						403: ErrorBody,
					},
				},
			},
			async (req, reply) => {
				await auth.changePassword(
					req.user.sub,
					req.body.currentPassword,
					req.body.newPassword,
				);
				return reply.code(204).send(null);
			},
		);
	};
