import type { FastifyInstance, FastifyRequest } from 'fastify';
import { API_PREFIX, ClientHeaders } from '@music-room/shared';
import type { PrismaClient } from '../db.js';

export type ClientInfo = { platform: string; device: string; appVersion: string };

export function clientInfo(req: FastifyRequest): ClientInfo {
	const h = ClientHeaders.parse(req.headers);
	return { platform: h['x-platform'], device: h['x-device'], appVersion: h['x-app-version'] };
}

const SKIPPED = new Set([`${API_PREFIX}/health`]);

// One ActionLog row per API call, written after the response is sent.
export function registerActionLog(app: FastifyInstance, prisma: PrismaClient): void {
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
		try {
			await prisma.actionLog.create({ data: entry });
		} catch (err) {
			req.log.error({ err }, 'action log write failed');
		}
	});
}
