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

export type AppDeps = { env: Env; prisma: PrismaClient; mailer: Mailer };

export async function buildApp({ env, prisma, mailer }: AppDeps): Promise<FastifyInstance> {
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

	const auth = createAuthService({
		prisma,
		mailer,
		log: app.log,
		signAccess: (claims) => app.jwt.sign(claims),
	});
	await app.register(healthRoutes(prisma), { prefix: API_PREFIX });
	await app.register(authRoutes(auth), { prefix: API_PREFIX });
	await app.register(meRoutes(auth), { prefix: API_PREFIX });
	return app;
}
