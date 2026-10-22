import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ErrorBody, HealthResponse } from '@music-room/shared';
import type { PrismaClient } from '../../db.js';

export const healthRoutes =
	(prisma: PrismaClient): FastifyPluginAsyncZod =>
	async (app) => {
		app.get(
			'/health',
			{
				schema: {
					summary: 'Liveness and database check',
					tags: ['health'],
					response: { 200: HealthResponse, 503: HealthResponse, 500: ErrorBody },
				},
			},
			async (req, reply) => {
				try {
					await prisma.$queryRaw`SELECT 1`;
					return { status: 'ok' as const, db: 'ok' as const };
				} catch (err) {
					req.log.error({ err }, 'database check failed');
					return reply.status(503).send({ status: 'ok', db: 'down' });
				}
			},
		);
	};
