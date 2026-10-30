import type { FastifyInstance, FastifyRequest } from 'fastify';
import jwt from '@fastify/jwt';
import { AuthErrorCode } from '@music-room/shared';
import type { Env } from '../config/env.js';
import { httpError } from './errors.js';

export const ACCESS_TTL_SEC = 15 * 60;

export type AccessClaims = { sub: string; deviceId: string | null };
// Who made the request, read by the action log.
export type Actor = { userId: string; deviceId: string | null };

declare module '@fastify/jwt' {
	interface FastifyJWT {
		payload: AccessClaims;
		user: AccessClaims;
	}
}

declare module 'fastify' {
	interface FastifyRequest {
		actor: Actor | null;
	}
	interface FastifyInstance {
		authenticate: (req: FastifyRequest) => Promise<void>;
	}
}

export async function registerAuth(app: FastifyInstance, env: Env): Promise<void> {
	await app.register(jwt, {
		secret: env.JWT_SECRET,
		sign: { algorithm: 'HS256', expiresIn: ACCESS_TTL_SEC },
		verify: { algorithms: ['HS256'] },
	});
	app.decorateRequest('actor', null);
	// preHandler for every route that needs a logged-in user.
	app.decorate('authenticate', async (req: FastifyRequest) => {
		try {
			await req.jwtVerify();
		} catch {
			throw httpError(401, AuthErrorCode.Unauthorized, 'Invalid or expired access token');
		}
		req.actor = { userId: req.user.sub, deviceId: req.user.deviceId };
	});
}
