import Fastify, { type FastifyInstance } from 'fastify';
import {
	serializerCompiler,
	validatorCompiler,
	type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { API_PREFIX } from '@music-room/shared';
import type { Env } from './config/env.js';
import type { PrismaClient } from './db.js';
import { registerErrorHandlers } from './plugins/errors.js';
import { registerSwagger } from './plugins/swagger.js';
import { healthRoutes } from './modules/health/routes.js';

export async function buildApp(env: Env, prisma: PrismaClient): Promise<FastifyInstance> {
	const app = Fastify({ logger: { level: env.LOG_LEVEL } }).withTypeProvider<ZodTypeProvider>();
	app.setValidatorCompiler(validatorCompiler);
	app.setSerializerCompiler(serializerCompiler);
	registerErrorHandlers(app);
	await registerSwagger(app);

	await app.register(healthRoutes(prisma), { prefix: API_PREFIX });
	return app;
}
