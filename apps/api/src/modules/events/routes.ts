import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
	CreateEventBody,
	EntryParams,
	ErrorBody,
	EventDetail,
	EventIdParams,
	EventList,
	EventListQuery,
	EventStateForUser,
	InviteBody,
	InviteeParams,
	InviteList,
	NextBody,
	SuggestBody,
	UpdateEventBody,
	VoteBody,
} from '@music-room/shared';
import type { EventQueue } from './queue.js';
import type { EventsService } from './service.js';

const tags = ['events'];
const security = [{ bearerAuth: [] }];
const NoContent = z.null().describe('Done');
const read = { 400: ErrorBody, 401: ErrorBody, 404: ErrorBody };
const owned = { ...read, 403: ErrorBody };
const voting = {
	...read,
	403: ErrorBody.describe('CANNOT_VOTE, LOCATION_REQUIRED, OUTSIDE_ZONE or OUTSIDE_WINDOW'),
	409: ErrorBody,
};

export const eventsRoutes =
	(events: EventsService, queue: EventQueue): FastifyPluginAsyncZod =>
	async (app) => {
		app.addHook('onRequest', app.authenticate);

		app.get(
			'/events',
			{
				schema: {
					summary: 'Events I can see: public, invited or mine',
					description:
						'Private events of other people are never listed. Paginated with limit and offset.',
					tags,
					security,
					querystring: EventListQuery,
					response: { 200: EventList, 400: ErrorBody, 401: ErrorBody },
				},
			},
			async (req) => events.list(req.user.sub, req.query),
		);

		app.post(
			'/events',
			{
				schema: {
					summary: 'Create an event',
					description:
						'The caller becomes the owner. A LOCATION vote license needs a zone.',
					tags,
					security,
					body: CreateEventBody,
					response: { 201: EventDetail, 400: ErrorBody, 401: ErrorBody },
				},
			},
			async (req, reply) => reply.code(201).send(await events.create(req.user.sub, req.body)),
		);

		app.get(
			'/events/:id',
			{
				schema: {
					summary: 'Event details',
					description: 'Private events answer 404 to people who are not invited.',
					tags,
					security,
					params: EventIdParams,
					response: { 200: EventDetail, ...read },
				},
			},
			async (req) => events.detail(req.user.sub, req.params.id),
		);

		app.patch(
			'/events/:id',
			{
				schema: {
					summary: 'Update an event (owner)',
					description:
						'Making a public event private removes from its live room whoever can no longer see it.',
					tags,
					security,
					params: EventIdParams,
					body: UpdateEventBody,
					response: { 200: EventDetail, ...owned },
				},
			},
			async (req) => events.update(req.user.sub, req.params.id, req.body),
		);

		app.delete(
			'/events/:id',
			{
				schema: {
					summary: 'Delete an event (owner)',
					description: 'Everybody in its live room is told with event:deleted.',
					tags,
					security,
					params: EventIdParams,
					response: { 204: NoContent, ...owned },
				},
			},
			async (req, reply) => {
				await events.remove(req.user.sub, req.params.id);
				return reply.code(204).send(null);
			},
		);

		app.get(
			'/events/:id/invites',
			{
				schema: {
					summary: 'Invited users (owner)',
					description: 'In invitation order, at most 500.',
					tags,
					security,
					params: EventIdParams,
					response: { 200: InviteList, ...owned },
				},
			},
			async (req) => events.invites(req.user.sub, req.params.id),
		);

		app.post(
			'/events/:id/invites',
			{
				schema: {
					summary: 'Invite a user (owner)',
					description: 'Idempotent. 404 when the user does not exist.',
					tags,
					security,
					params: EventIdParams,
					body: InviteBody,
					response: { 204: NoContent, ...owned },
				},
			},
			async (req, reply) => {
				await events.invite(req.user.sub, req.params.id, req.body.userId);
				return reply.code(204).send(null);
			},
		);

		app.delete(
			'/events/:id/invites/:userId',
			{
				schema: {
					summary: 'Withdraw an invitation (owner)',
					description: 'On a private event the user also leaves its live room at once.',
					tags,
					security,
					params: InviteeParams,
					response: { 204: NoContent, ...owned },
				},
			},
			async (req, reply) => {
				await events.uninvite(req.user.sub, req.params.id, req.params.userId);
				return reply.code(204).send(null);
			},
		);

		app.get(
			'/events/:id/state',
			{
				schema: {
					summary: 'Now playing, ranked queue and my votes',
					description:
						'Same state as the event:state broadcast, plus the entries the caller voted for.',
					tags,
					security,
					params: EventIdParams,
					response: { 200: EventStateForUser, ...read },
				},
			},
			async (req) => {
				await events.detail(req.user.sub, req.params.id);
				return queue.stateFor(req.user.sub, req.params.id);
			},
		);

		app.post(
			'/events/:id/tracks',
			{
				schema: {
					summary: 'Suggest a track',
					description:
						'Counts as your vote. A track already queued gets your vote instead of a second entry.',
					tags,
					security,
					params: EventIdParams,
					body: SuggestBody,
					response: {
						200: EventStateForUser,
						...voting,
						422: ErrorBody,
						502: ErrorBody,
						503: ErrorBody,
					},
				},
			},
			async (req) =>
				queue.suggest(req.user.sub, req.params.id, req.body.deezerId, req.body.coords),
		);

		app.post(
			'/events/:id/tracks/:entryId/vote',
			{
				schema: {
					summary: 'Vote for a queued track',
					description: 'Idempotent: voting twice keeps one vote.',
					tags,
					security,
					params: EntryParams,
					body: VoteBody,
					response: { 200: EventStateForUser, ...voting },
				},
			},
			async (req) =>
				queue.vote(req.user.sub, req.params.id, req.params.entryId, req.body.coords),
		);

		app.delete(
			'/events/:id/tracks/:entryId/vote',
			{
				schema: {
					summary: 'Remove my vote',
					description: 'Idempotent. 409 STALE when the track already played.',
					tags,
					security,
					params: EntryParams,
					response: { 200: EventStateForUser, ...read, 409: ErrorBody },
				},
			},
			async (req) => queue.unvote(req.user.sub, req.params.id, req.params.entryId),
		);

		app.post(
			'/events/:id/next',
			{
				schema: {
					summary: 'Skip to the most voted track (owner or delegate)',
					description:
						"The owner, or a friend with an active control grant on one of the owner's devices. currentEntryId is the entry the caller saw playing; 409 STALE if it already changed.",
					tags,
					security,
					params: EventIdParams,
					body: NextBody,
					response: { 200: EventStateForUser, ...owned, 409: ErrorBody },
				},
			},
			async (req) => queue.next(req.user.sub, req.params.id, req.body.currentEntryId),
		);
	};
