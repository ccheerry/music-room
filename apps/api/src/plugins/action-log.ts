import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from 'fastify';
import { API_PREFIX, ClientHeaders } from '@music-room/shared';
import type { PrismaClient } from '../db.js';

export type ClientInfo = { platform: string; device: string; appVersion: string };

export function clientInfo(req: FastifyRequest): ClientInfo {
	const h = ClientHeaders.parse(req.headers);
	return { platform: h['x-platform'], device: h['x-device'], appVersion: h['x-app-version'] };
}

const SKIPPED = new Set([`${API_PREFIX}/health`]);

export type ActionEntry = ClientInfo & {
	userId: string | null;
	deviceId: string | null;
	action: string;
	status: number;
};
type WriterOptions = { flushMs?: number; batch?: number; max?: number };

// Actions are buffered and stored in batches, so logging never costs a query per action.
// The buffer is bounded: under a flood, rows are dropped rather than held in memory.
export function createActionLogWriter(
	prisma: PrismaClient,
	log: FastifyBaseLogger,
	{ flushMs = 250, batch = 500, max = 20_000 }: WriterOptions = {},
) {
	let buffer: (ActionEntry & { createdAt: Date })[] = [];
	let dropped = 0;
	let flushing: Promise<void> | null = null;

	function write(entry: ActionEntry): void {
		if (buffer.length >= max) dropped++;
		else buffer.push({ ...entry, createdAt: new Date() });
	}

	// A row whose device or user was removed meanwhile is kept without that link.
	const storeOne = (row: (typeof buffer)[number]) =>
		prisma.actionLog
			.create({ data: row })
			.catch(() => prisma.actionLog.create({ data: { ...row, deviceId: null } }))
			.catch(() =>
				prisma.actionLog.create({ data: { ...row, deviceId: null, userId: null } }),
			)
			.catch((err: unknown) => log.error({ err }, 'action log write failed'));

	async function drain(): Promise<void> {
		while (buffer.length > 0) {
			const rows = buffer.slice(0, batch);
			buffer = buffer.slice(batch);
			try {
				await prisma.actionLog.createMany({ data: rows });
			} catch {
				for (const row of rows) await storeOne(row);
			}
		}
		if (dropped > 0) {
			log.warn({ dropped }, 'action log buffer full, rows dropped');
			dropped = 0;
		}
	}

	const flush = () => (flushing ??= drain().finally(() => (flushing = null)));
	const timer = setInterval(() => void flush(), flushMs);
	timer.unref();

	async function close(): Promise<void> {
		clearInterval(timer);
		await flush();
		await flush();
	}

	return { write, flush, close };
}

export type ActionLogWriter = ReturnType<typeof createActionLogWriter>;

// One ActionLog row per API call, queued once the response is sent.
export function registerActionLog(app: FastifyInstance, writer: ActionLogWriter): void {
	app.addHook('onResponse', async (req, reply) => {
		const route = req.routeOptions.url;
		if (!route?.startsWith(API_PREFIX) || SKIPPED.has(route)) return;

		const entry = {
			userId: req.actor?.userId ?? null,
			deviceId: req.actor?.deviceId ?? null,
			...clientInfo(req),
			action: `${req.method} ${route}`,
			status: reply.statusCode,
		};
		req.log.info(entry, 'action');
		writer.write(entry);
	});
}
