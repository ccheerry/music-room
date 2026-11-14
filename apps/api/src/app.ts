import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
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
import { createActionLogWriter, registerActionLog } from './plugins/action-log.js';
import { type AccessClaims, registerAuth } from './plugins/auth.js';
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
	deezerQuota?: { max: number; windowMs: number };
	// Length of a played preview; shortened in tests.
	previewMs?: number;
};

// Every body of the API is a small JSON document.
const BODY_LIMIT_BYTES = 100 * 1024;

export async function buildApp(deps: AppDeps): Promise<FastifyInstance> {
	const { env, prisma, mailer } = deps;
	const app = Fastify({
		logger: { level: env.LOG_LEVEL },
		bodyLimit: BODY_LIMIT_BYTES,
		trustProxy: env.TRUST_PROXY,
	}).withTypeProvider<ZodTypeProvider>();
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	registerErrorHandlers(app);
	await app.register(cors, {
		origin: env.CORS_ORIGINS,
		methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
	});
	await registerSwagger(app);
	// The only HTML served is the interactive docs, which need their own script and style rules.
	await app.register(helmet, (instance) => ({
		contentSecurityPolicy: {
			directives: {
				'default-src': ["'self'"],
				'img-src': ["'self'", 'data:', 'validator.swagger.io'],
				'script-src': ["'self'", ...instance.swaggerCSP.script],
				'style-src': ["'self'", 'https:', ...instance.swaggerCSP.style],
			},
		},
	}));
	await registerAuth(app, env);
	const actionLog = createActionLogWriter(prisma, app.log);
	registerActionLog(app, actionLog);
	// Every route: a budget per logged-in user, per address otherwise. Runs before anything
	// is parsed; routes add stricter buckets of their own.
	await app.register(rateLimit, {
		global: true,
		max: env.RATE_LIMIT_MAX,
		timeWindow: '1 minute',
		keyGenerator: (req) => {
			try {
				const token = req.headers.authorization?.replace(/^Bearer /i, '') ?? '';
				return `user:${app.jwt.verify<AccessClaims>(token).sub}`;
			} catch {
				return req.ip;
			}
		},
		errorResponseBuilder: (_req, ctx) =>
			httpError(429, 'RATE_LIMITED', `Too many requests, retry in ${ctx.after}`),
	});

	const { io, realtime } = createRealtime({
		server: app.server,
		corsOrigins: env.CORS_ORIGINS,
		verify: (token) => app.jwt.verify(token),
		actionLog,
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
	await app.register(authRoutes(auth, env.AUTH_RATE_LIMIT_MAX), { prefix: API_PREFIX });
	// Ending a friendship revokes device control both ways.
	let onUnfriend: (a: string, b: string) => Promise<void> = async () => undefined;
	const friends = createFriendsService({ prisma, onUnfriend: (a, b) => onUnfriend(a, b) });
	const users = createUsersService({ prisma, friends });
	await app.register(meRoutes(auth, users), { prefix: API_PREFIX });
	await app.register(usersRoutes(users), { prefix: API_PREFIX });
	await app.register(friendsRoutes(friends), { prefix: API_PREFIX });
	const deezer = createDeezerClient({ fetch: deps.deezerFetch, quota: deps.deezerQuota });
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
			onRestricted: (eventId) => realtime.recheck(`event:${eventId}`),
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
			onRestricted: (id) => realtime.recheck(`playlist:${id}`),
		},
	});
	realtime.registerRoom('playlist', async (userId, id) => {
		const playlist = await prisma.playlist.findUnique({ where: { id } });
		return !!playlist && (await canViewPlaylist(prisma, playlist, userId));
	});
	await app.register(playlistsRoutes(playlists, editor), { prefix: API_PREFIX });

	const devices = createDevicesService({ prisma, friends, realtime });
	onUnfriend = devices.revokeBetween;
	realtime.registerRoom('remote', devices.canJoin);
	realtime.on('device:command', devices.onCommand);
	realtime.on('device:status', devices.onStatus);
	await app.register(devicesRoutes(devices), { prefix: API_PREFIX });
	app.addHook('onClose', async () => {
		queue.stop();
		devices.stop();
		await actionLog.close();
	});
	const verifier = deps.socialVerifier ?? createSocialVerifier(env);
	const social = createSocialService({ prisma, verifier, auth });
	await app.register(socialRoutes(social), { prefix: API_PREFIX });
	return app;
}
