import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ChangePasswordBody, ErrorBody, MeResponse } from '@music-room/shared';
import type { AuthService } from '../auth/service.js';

const tags = ['me'];
const security = [{ bearerAuth: [] }];

export const meRoutes =
	(auth: AuthService): FastifyPluginAsyncZod =>
	async (app) => {
		app.addHook('preHandler', app.authenticate);

		app.get(
			'/me',
			{
				schema: {
					summary: 'Current user',
					tags,
					security,
					response: { 200: MeResponse, 401: ErrorBody },
				},
			},
			async (req) => auth.me(req.user.sub),
		);

		app.put(
			'/me/password',
			{
				schema: {
					summary: 'Change the password',
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
