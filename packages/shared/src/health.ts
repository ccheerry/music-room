import { z } from 'zod';

export const HealthQuery = z.object({
	verbose: z
		.enum(['true', 'false', '1', '0', ''])
		.optional()
		.transform((v) => v !== undefined && v !== 'false' && v !== '0'),
});
export type HealthQuery = z.infer<typeof HealthQuery>;

// Process figures watched during load tests.
export const HealthMetrics = z.object({
	uptimeS: z.number(),
	rssMb: z.number(),
	heapUsedMb: z.number(),
	eventLoopDelayMs: z.object({ p50: z.number(), p99: z.number(), max: z.number() }),
	dbConnections: z.number().int().nullable(),
});
export type HealthMetrics = z.infer<typeof HealthMetrics>;

export const HealthResponse = z.object({
	status: z.literal('ok'),
	db: z.enum(['ok', 'down']),
	metrics: HealthMetrics.optional(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
