import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { API_PREFIX } from '@music-room/shared';
import type { Env } from './config/env.js';
import type { PrismaClient } from './db.js';
import type { Mailer } from './mail/mailer.js';
import { registerActionLog } from './plugins/action-log.js';
import { registerAuth } from './plugins/auth.js';
import { httpError, registerErrorHandlers } from './plugins/errors.js';
import { registerSwagger } from './plugins/swagger.js';
import { healthRoutes } from './modules/health/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { createAuthService } from './modules/auth/service.js';
import { meRoutes } from './modules/me/routes.js';
import { socialRoutes } from './modules/social/routes.js';
import { createSocialService } from './modules/social/service.js';
import { createSocialVerifier, type SocialVerifier } from './lib/social.js';
import { friendsRoutes } from './modules/friends/routes.js';
import { createFriendsService } from './modules/friends/service.js';
import { usersRoutes } from './modules/users/routes.js';
import { catalogRoutes } from './modules/catalog/routes.js';
import { createDeezerClient } from './modules/catalog/deezer.js';
import { createCatalogService } from './modules/catalog/service.js';
import { createRealtime, type Realtime } from './modules/realtime/server.js';
import { canView as canViewEvent } from './modules/events/access.js';
import { createEventQueue } from './modules/events/queue.js';
import { eventsRoutes } from './modules/events/routes.js';
import { createEventsService } from './modules/events/service.js';
import { canView as canViewPlaylist } from './modules/playlists/access.js';
import { createPlaylistEditor } from './modules/playlists/editor.js';
import { playlistsRoutes } from './modules/playlists/routes.js';
import { createPlaylistsService } from './modules/playlists/service.js';
import { devicesRoutes } from './modules/devices/routes.js';
import { createDevicesService } from './modules/devices/service.js';

declare module 'fastify' {
	interface FastifyInstance {
		realtime: Realtime;
	}
}
import { createUsersService } from './modules/users/service.js';

export type AppDeps = {
	env: Env;
	prisma: PrismaClient;
	mailer: Mailer;
	// Replaced in tests: providers and Deezer are mocked at these boundaries.
	socialVerifier?: SocialVerifier;
	deezerFetch?: typeof fetch;
	// Length of a played preview; shortened in tests.
	previewMs?: number;
};

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
	const { env, prisma, mailer } = deps;
	const app = Fastify({ logger: { level: env.LOG_LEVEL } }).withTypeProvider<ZodTypeProvider>();
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	registerErrorHandlers(app);
	await registerSwagger(app);
	await registerAuth(app, env);
	registerActionLog(app, prisma);
	// Opt-in per route; runs after validation so the key can use the normalised email.
	await app.register(rateLimit, {
		global: false,
		hook: 'preHandler',
		keyGenerator: (req) => (req.body as { email?: string } | undefined)?.email ?? req.ip,
		errorResponseBuilder: (_req, ctx) =>
			httpError(429, 'RATE_LIMITED', `Too many requests, retry in ${ctx.after}`),
	});

	const { io, realtime } = createRealtime({
		server: app.server,
		verify: (token) => app.jwt.verify(token),
		prisma,
		log: app.log,
	});
	app.addHook('preClose', async () => {
		io.local.disconnectSockets(true);
	});
	app.addHook('onClose', async () => {
		io.engine.close();
	});
	app.decorate('realtime', realtime);

	const auth = createAuthService({
		prisma,
		mailer,
		log: app.log,
		signAccess: (claims) => app.jwt.sign(claims),
		linkBase: env.APP_LINK_URL,
	});
	await app.register(healthRoutes(prisma), { prefix: API_PREFIX });
	await app.register(authRoutes(auth), { prefix: API_PREFIX });
	// Ending a friendship revokes device control both ways.
	let onUnfriend: (a: string, b: string) => Promise<void> = async () => undefined;
	const friends = createFriendsService({ prisma, onUnfriend: (a, b) => onUnfriend(a, b) });
	const users = createUsersService({ prisma, friends });
	await app.register(meRoutes(auth, users), { prefix: API_PREFIX });
	await app.register(usersRoutes(users), { prefix: API_PREFIX });
	await app.register(friendsRoutes(friends), { prefix: API_PREFIX });
	const deezer = createDeezerClient({ fetch: deps.deezerFetch });
	const catalog = createCatalogService({ prisma, deezer });
	await app.register(catalogRoutes(catalog), { prefix: API_PREFIX });

	const queue = createEventQueue({ prisma, catalog, realtime, previewMs: deps.previewMs });
	const events = createEventsService({
		prisma,
		hooks: {
			onDeleted: (eventId) => {
				queue.forget(eventId);
				realtime.emitTo(`event:${eventId}`, 'event:deleted', { eventId });
			},
			onAccessLost: (eventId, userId) => realtime.kick(userId, `event:${eventId}`),
		},
	});
	realtime.registerRoom('event', async (userId, id) => {
		const event = await prisma.event.findUnique({ where: { id } });
		return !!event && (await canViewEvent(prisma, event, userId));
	});
	await app.register(eventsRoutes(events, queue), { prefix: API_PREFIX });
	app.addHook('onReady', () => queue.resume());

	const editor = createPlaylistEditor({
		prisma,
		catalog,
		broadcast: (state) =>
			realtime.emitTo(`playlist:${state.playlistId}`, 'playlist:state', state),
	});
	const playlists = createPlaylistsService({
		prisma,
		hooks: {
			onChanged: (id) =>
				void editor
					.state(id)
					.then((state) => realtime.emitTo(`playlist:${id}`, 'playlist:state', state))
					.catch(() => undefined),
			onDeleted: (id) =>
				realtime.emitTo(`playlist:${id}`, 'playlist:deleted', { playlistId: id }),
			onAccessLost: (id, userId) => realtime.kick(userId, `playlist:${id}`),
		},
	});
	realtime.registerRoom('playlist', async (userId, id) => {
		const playlist = await prisma.playlist.findUnique({ where: { id } });
		return !!playlist && (await canViewPlaylist(prisma, playlist, userId));
	});
	await app.register(playlistsRoutes(playlists, editor), { prefix: API_PREFIX });

	const devices = createDevicesService({ prisma, friends, realtime });
	onUnfriend = devices.revokeBetween;
	realtime.registerRoom('remote', devices.canControl);
	realtime.on('device:command', devices.onCommand);
	realtime.on('device:status', devices.onStatus);
	await app.register(devicesRoutes(devices), { prefix: API_PREFIX });
	app.addHook('onClose', async () => queue.stop());
	const verifier = deps.socialVerifier ?? createSocialVerifier(env);
	const social = createSocialService({ prisma, verifier, auth });
	await app.register(socialRoutes(social), { prefix: API_PREFIX });
	return app;
}
