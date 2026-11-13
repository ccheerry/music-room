import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import {
	ErrorBody,
	GenreList,
	Track,
	TrackList,
	TrackParams,
	TrackSearchQuery,
} from '@music-room/shared';
import type { CatalogService } from './service.js';

const tags = ['catalog'];
const security = [{ bearerAuth: [] }];
const upstream = { 502: ErrorBody, 503: ErrorBody };

export const catalogRoutes =
	(catalog: CatalogService): FastifyPluginAsyncZod =>
	async (app) => {
		app.addHook('preHandler', app.authenticate);

		app.get(
			'/tracks/search',
			{
				schema: {
					summary: 'Search Deezer tracks',
					description:
						'Cached for 5 minutes. 503 CATALOG_BUSY when the Deezer quota is used up.',
					tags,
					security,
					querystring: TrackSearchQuery,
					response: { 200: TrackList, 400: ErrorBody, 401: ErrorBody, ...upstream },
				},
			},
			async (req) => ({ items: await catalog.search(req.query.q, req.query.limit) }),
		);

		app.get(
			'/tracks/:deezerId',
			{
				schema: {
					summary: 'One track, with a fresh preview URL',
					tags,
					security,
					params: TrackParams,
					response: {
						200: Track,
						400: ErrorBody,
						401: ErrorBody,
						404: ErrorBody,
						...upstream,
					},
				},
			},
			async (req) => catalog.getTrack(req.params.deezerId),
		);

		app.get(
			'/genres',
			{
				schema: {
					summary: 'Music genres, for profile preferences',
					tags,
					security,
					response: { 200: GenreList, 401: ErrorBody, ...upstream },
				},
			},
			async () => catalog.genres(),
		);
	};
