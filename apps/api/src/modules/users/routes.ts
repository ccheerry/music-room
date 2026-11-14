import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
	ErrorBody,
	UserIdParams,
	UserList,
	UserProfile,
	UserSearchQuery,
} from '@music-room/shared';
import type { UsersService } from './service.js';

const tags = ['users'];
const security = [{ bearerAuth: [] }];

export const usersRoutes =
	(users: UsersService): FastifyPluginAsyncZod =>
	async (app) => {
		app.addHook('onRequest', app.authenticate);

		app.get(
			'/users',
			{
				schema: {
					summary: 'Search users by display name prefix',
					description: 'Only ids and display names.',
					tags,
					security,
					querystring: UserSearchQuery,
					response: { 200: UserList, 400: ErrorBody, 401: ErrorBody },
				},
			},
			async (req) => users.search(req.query),
		);

		app.get(
			'/users/:id',
			{
				schema: {
					summary: 'A user profile, filtered by relationship',
					description:
						'Strangers get publicInfo, friends also friendsInfo, the owner everything.',
					tags,
					security,
					params: UserIdParams,
					response: { 200: UserProfile, 400: ErrorBody, 401: ErrorBody, 404: ErrorBody },
				},
			},
			async (req) => users.getProfile(req.user.sub, req.params.id),
		);
	};
