import { z } from 'zod';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
	AddEntryBody,
	CreatePlaylistBody,
	ErrorBody,
	MemberBody,
	MemberList,
	MemberParams,
	MoveEntryBody,
	PlaylistDetail,
	PlaylistEntryParams,
	PlaylistIdParams,
	PlaylistList,
	PlaylistListQuery,
	PlaylistState,
	StaleResponse,
	UpdatePlaylistBody,
} from '@music-room/shared';
import type { PlaylistEditor } from './editor.js';
import type { PlaylistsService } from './service.js';

const tags = ['playlists'];
const security = [{ bearerAuth: [] }];
const NoContent = z.null().describe('Done');
const read = { 400: ErrorBody, 401: ErrorBody, 404: ErrorBody };
const owned = { ...read, 403: ErrorBody };
const editing = {
	...owned,
	409: StaleResponse.describe('STALE: an entry named in the request no longer exists'),
};

export const playlistsRoutes =
	(playlists: PlaylistsService, editor: PlaylistEditor): FastifyPluginAsyncZod =>
	async (app) => {
		app.addHook('onRequest', app.authenticate);

		app.get(
			'/playlists',
			{
				schema: {
					summary: 'Playlists I can see: public, shared with me or mine',
					description:
						'Private playlists of other people are never listed. Paginated with limit and offset.',
					tags,
					security,
					querystring: PlaylistListQuery,
					response: { 200: PlaylistList, 400: ErrorBody, 401: ErrorBody },
				},
			},
			async (req) => playlists.list(req.user.sub, req.query),
		);

		app.post(
			'/playlists',
			{
				schema: {
					summary: 'Create a playlist',
					description: 'The caller becomes the owner.',
					tags,
					security,
					body: CreatePlaylistBody,
					response: { 201: PlaylistDetail, 400: ErrorBody, 401: ErrorBody },
				},
			},
			async (req, reply) =>
				reply.code(201).send(await playlists.create(req.user.sub, req.body)),
		);

		app.get(
			'/playlists/:id',
			{
				schema: {
					summary: 'Playlist details',
					description: 'Private playlists answer 404 to people who are not members.',
					tags,
					security,
					params: PlaylistIdParams,
					response: { 200: PlaylistDetail, ...read },
				},
			},
			async (req) => playlists.detail(req.user.sub, req.params.id),
		);

		app.patch(
			'/playlists/:id',
			{
				schema: {
					summary: 'Rename or change the licenses (owner)',
					description:
						'Making a public playlist private removes from its live room whoever can no longer see it.',
					tags,
					security,
					params: PlaylistIdParams,
					body: UpdatePlaylistBody,
					response: { 200: PlaylistDetail, ...owned },
				},
			},
			async (req) => playlists.update(req.user.sub, req.params.id, req.body),
		);

		app.delete(
			'/playlists/:id',
			{
				schema: {
					summary: 'Delete a playlist (owner)',
					description: 'Everybody in its live room is told with playlist:deleted.',
					tags,
					security,
					params: PlaylistIdParams,
					response: { 204: NoContent, ...owned },
				},
			},
			async (req, reply) => {
				await playlists.remove(req.user.sub, req.params.id);
				return reply.code(204).send(null);
			},
		);

		app.get(
			'/playlists/:id/members',
			{
				schema: {
					summary: 'Invited members',
					description: 'Visible to whoever can see the playlist, at most 500.',
					tags,
					security,
					params: PlaylistIdParams,
					response: { 200: MemberList, ...read },
				},
			},
			async (req) => playlists.members(req.user.sub, req.params.id),
		);

		app.post(
			'/playlists/:id/members',
			{
				schema: {
					summary: 'Invite a member (owner)',
					description: 'Idempotent. 404 when the user does not exist.',
					tags,
					security,
					params: PlaylistIdParams,
					body: MemberBody,
					response: { 204: NoContent, ...owned },
				},
			},
			async (req, reply) => {
				await playlists.addMember(req.user.sub, req.params.id, req.body.userId);
				return reply.code(204).send(null);
			},
		);

		app.delete(
			'/playlists/:id/members/:userId',
			{
				schema: {
					summary: 'Remove a member (owner)',
					description:
						'On a private playlist the user also leaves its live room at once.',
					tags,
					security,
					params: MemberParams,
					response: { 204: NoContent, ...owned },
				},
			},
			async (req, reply) => {
				await playlists.removeMember(req.user.sub, req.params.id, req.params.userId);
				return reply.code(204).send(null);
			},
		);

		app.get(
			'/playlists/:id/entries',
			{
				schema: {
					summary: 'Entries in order, with the playlist version',
					description: 'Same state as the playlist:state broadcast.',
					tags,
					security,
					params: PlaylistIdParams,
					response: { 200: PlaylistState, ...read },
				},
			},
			async (req) => editor.read(req.user.sub, req.params.id),
		);

		app.post(
			'/playlists/:id/entries',
			{
				schema: {
					summary: 'Add a track',
					description:
						'afterEntryId: null puts it first, omitted puts it last. The same track may appear several times. 422 LIST_FULL at 500 entries.',
					tags,
					security,
					params: PlaylistIdParams,
					body: AddEntryBody,
					response: {
						200: PlaylistState,
						...editing,
						422: ErrorBody,
						502: ErrorBody,
						503: ErrorBody,
					},
				},
			},
			async (req) =>
				editor.add(req.user.sub, req.params.id, req.body.deezerId, req.body.afterEntryId),
		);

		app.patch(
			'/playlists/:id/entries/:entryId',
			{
				schema: {
					summary: 'Move an entry after another one (null = first)',
					description:
						'409 STALE with the current state when the entry or its new neighbour was removed meanwhile.',
					tags,
					security,
					params: PlaylistEntryParams,
					body: MoveEntryBody,
					response: { 200: PlaylistState, ...editing },
				},
			},
			async (req) =>
				editor.move(req.user.sub, req.params.id, req.params.entryId, req.body.afterEntryId),
		);

		app.delete(
			'/playlists/:id/entries/:entryId',
			{
				schema: {
					summary: 'Remove an entry',
					description: '409 STALE with the current state when it was already removed.',
					tags,
					security,
					params: PlaylistEntryParams,
					response: { 200: PlaylistState, ...editing },
				},
			},
			async (req) => editor.remove(req.user.sub, req.params.id, req.params.entryId),
		);
	};
