import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ErrorBody, HealthQuery, HealthResponse, type HealthMetrics } from '@music-room/shared';
import type { PrismaClient } from '../../db.js';

const MB = 1024 * 1024;
const NS_PER_MS = 1e6;

export const healthRoutes =
	(prisma: PrismaClient): FastifyPluginAsyncZod =>
	async (app) => {
		const loopDelay = monitorEventLoopDelay({ resolution: 20 });
		loopDelay.enable();
		app.addHook('onClose', async () => loopDelay.disable());

		const metrics = async (): Promise<HealthMetrics> => {
			const mem = process.memoryUsage();
			const rows = await prisma.$queryRaw<{ n: bigint }[]>`
				SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database()`.catch(() => null);
			const ms = (ns: number) => Math.round((ns / NS_PER_MS) * 100) / 100;
			return {
				uptimeS: Math.round(process.uptime()),
				rssMb: Math.round(mem.rss / MB),
				heapUsedMb: Math.round(mem.heapUsed / MB),
				eventLoopDelayMs: {
					p50: ms(loopDelay.percentile(50)),
					p99: ms(loopDelay.percentile(99)),
					max: ms(loopDelay.max),
				},
				dbConnections: rows ? Number(rows[0]!.n) : null,
			};
		};

		app.get(
			'/health',
			{
				schema: {
					summary: 'Liveness and database check',
					description:
						'Public. 503 when the database does not answer. With `verbose=true` it adds process figures (memory, event-loop delay, database connections) used during load tests.',
					tags: ['health'],
					querystring: HealthQuery,
					response: { 200: HealthResponse, 503: HealthResponse, 500: ErrorBody },
				},
			},
			async (req, reply) => {
				const extra = req.query.verbose ? { metrics: await metrics() } : {};
				try {
					await prisma.$queryRaw`SELECT 1`;
					return { status: 'ok' as const, db: 'ok' as const, ...extra };
				} catch (err) {
					req.log.error({ err }, 'database check failed');
					return reply.status(503).send({ status: 'ok', db: 'down', ...extra });
				}
			},
		);
	};
