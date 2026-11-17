import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { ErrorBody, HealthQuery, HealthResponse, type HealthMetrics } from '@music-room/shared';
import type { PrismaClient } from '../../db.js';

const MB = 1024 * 1024;
const NS_PER_MS = 1e6;
const RESOLUTION_MS = 10;

export const healthRoutes =
	(prisma: PrismaClient, verboseEnabled: boolean): FastifyPluginAsyncZod =>
	async (app) => {
		const loopDelay = monitorEventLoopDelay({ resolution: RESOLUTION_MS });
		loopDelay.enable();
		app.addHook('onClose', async () => loopDelay.disable());

		const metrics = async (): Promise<HealthMetrics> => {
			const mem = process.memoryUsage();
			const rows = await prisma.$queryRaw<{ n: bigint }[]>`
				SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database()`.catch(() => null);
			// The histogram counts the sampling interval itself: only the excess is delay.
			const ms = (ns: number) =>
				Math.max(0, Math.round((ns / NS_PER_MS - RESOLUTION_MS) * 100) / 100);
			const delay = {
				p50: ms(loopDelay.percentile(50)),
				p99: ms(loopDelay.percentile(99)),
				max: ms(loopDelay.max),
			};
			// Each verbose read covers the time since the previous one.
			loopDelay.reset();
			return {
				uptimeS: Math.round(process.uptime()),
				rssMb: Math.round(mem.rss / MB),
				heapUsedMb: Math.round(mem.heapUsed / MB),
				eventLoopDelayMs: delay,
				dbConnections: rows ? Number(rows[0]!.n) : null,
			};
		};

		app.get(
			'/health',
			{
				schema: {
					summary: 'Liveness and database check',
					description:
						'Public. 503 when the database does not answer. With `verbose=true`, and only when the server runs with `HEALTH_VERBOSE=true`, it adds process figures used during load tests: memory, database connections and the event-loop delay since the previous verbose call.',
					tags: ['health'],
					querystring: HealthQuery,
					response: { 200: HealthResponse, 503: HealthResponse, 500: ErrorBody },
				},
			},
			async (req, reply) => {
				const extra =
					verboseEnabled && req.query.verbose ? { metrics: await metrics() } : {};
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
