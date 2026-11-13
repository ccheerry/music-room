import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
	ErrorBody,
	FriendList,
	FriendRequestBody,
	FriendRequestResult,
	FriendRequests,
	UserIdParams,
} from '@music-room/shared';
import type { FriendsService } from './service.js';

const tags = ['friends'];
const security = [{ bearerAuth: [] }];
const NoContent = z.null().describe('Done');
const errors = { 400: ErrorBody, 401: ErrorBody, 404: ErrorBody };

export const friendsRoutes =
	(friends: FriendsService): FastifyPluginAsyncZod =>
	async (app) => {
		app.addHook('preHandler', app.authenticate);

		app.get(
			'/friends',
			{
				schema: {
					summary: 'Accepted friends',
					tags,
					security,
					response: { 200: FriendList, 401: ErrorBody },
				},
			},
			async (req) => friends.list(req.user.sub),
		);

		app.get(
			'/friends/requests',
			{
				schema: {
					summary: 'Pending requests, incoming and outgoing',
					tags,
					security,
					response: { 200: FriendRequests, 401: ErrorBody },
				},
			},
			async (req) => friends.requests(req.user.sub),
		);

		app.post(
			'/friends/requests',
			{
				schema: {
					summary: 'Send a friend request',
					description: 'If that user already asked you, you become friends.',
					tags,
					security,
					body: FriendRequestBody,
					response: { 200: FriendRequestResult, ...errors },
				},
			},
			async (req) => friends.request(req.user.sub, req.body.userId),
		);

		app.post(
			'/friends/requests/:id/accept',
			{
				schema: {
					summary: 'Accept the request sent by user :id',
					tags,
					security,
					params: UserIdParams,
					response: { 204: NoContent, ...errors },
				},
			},
			async (req, reply) => {
				await friends.accept(req.user.sub, req.params.id);
				return reply.code(204).send(null);
			},
		);

		app.delete(
			'/friends/requests/:id',
			{
				schema: {
					summary: 'Decline the request from, or cancel the request to, user :id',
					tags,
					security,
					params: UserIdParams,
					response: { 204: NoContent, ...errors },
				},
			},
			async (req, reply) => {
				await friends.dropRequest(req.user.sub, req.params.id);
				return reply.code(204).send(null);
			},
		);

		app.delete(
			'/friends/:id',
			{
				schema: {
					summary: 'Remove a friend',
					tags,
					security,
					params: UserIdParams,
					response: { 204: NoContent, ...errors },
				},
			},
			async (req, reply) => {
				await friends.remove(req.user.sub, req.params.id);
				return reply.code(204).send(null);
			},
		);
	};
