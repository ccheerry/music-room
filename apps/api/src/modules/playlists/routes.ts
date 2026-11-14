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
		app.addHook('preHandler', app.authenticate);

		app.get(
			'/playlists',
			{
				schema: {
					summary: 'Playlists I can see: public, shared with me or mine',
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
						'afterEntryId: null puts it first, omitted puts it last. The same track may appear several times.',
					tags,
					security,
					params: PlaylistIdParams,
					body: AddEntryBody,
					response: { 200: PlaylistState, ...editing, 502: ErrorBody, 503: ErrorBody },
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
					tags,
					security,
					params: PlaylistEntryParams,
					response: { 200: PlaylistState, ...editing },
				},
			},
			async (req) => editor.remove(req.user.sub, req.params.id, req.params.entryId),
		);
	};
