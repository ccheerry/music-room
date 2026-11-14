import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
	buildTestApp,
	call,
	CLIENT,
	closeTestApp,
	createUser,
	PASSWORD,
	type TestApp,
	type TestUser,
} from './helpers.js';

let t: TestApp;

beforeAll(async () => {
	t = await buildTestApp();
});

afterAll(() => closeTestApp(t));

describe('HTTP hardening', () => {
	it('sends the security headers on API answers', async () => {
		const res = await call(t, 'GET', '/health');
		expect(res.headers['x-content-type-options']).toBe('nosniff');
		expect(res.headers['x-frame-options']).toBeDefined();
		expect(res.headers['content-security-policy']).toBeDefined();
		expect(res.headers['x-powered-by']).toBeUndefined();
	});

	it('still serves the interactive docs', async () => {
		const res = await t.app.inject({ method: 'GET', url: '/docs/' });
		expect(res.statusCode).toBe(200);
		expect(res.headers['content-security-policy']).toContain("script-src 'self'");
	});

	it('refuses oversized bodies with the usual error shape', async () => {
		const res = await call(t, 'POST', '/auth/login', null, {
			email: 'a@test.local',
			password: 'x'.repeat(200_000),
		});
		expect(res.statusCode).toBe(413);
		expect(res.json().error.code).toBeDefined();
	});

	it('answers 503 with a retry delay, not 500, when the database is saturated', async () => {
		const busy = await buildTestApp();
		try {
			// What Prisma raises when no connection frees up in time.
			busy.app.get('/saturated', async () => {
				throw Object.assign(new Error('Unable to start a transaction'), { code: 'P2028' });
			});
			const res = await busy.app.inject({ method: 'GET', url: '/saturated' });
			expect(res.statusCode).toBe(503);
			expect(res.json().error.code).toBe('BUSY');
			expect(res.headers['retry-after']).toBeDefined();
		} finally {
			await closeTestApp(busy);
		}
	});

	it('never leaks a stack trace or the framework error on a broken body', async () => {
		const res = await t.app.inject({
			method: 'POST',
			url: '/api/v1/auth/login',
			headers: { ...CLIENT, 'content-type': 'application/json' },
			payload: '{"email": ',
		});
		expect(res.statusCode).toBe(400);
		expect(Object.keys(res.json())).toEqual(['error']);
		expect(res.body).not.toMatch(/at .*\.(js|ts)/);
	});
});

describe('request limits', () => {
	it('limits every caller globally, per user', async () => {
		const limited = await buildTestApp({ env: { RATE_LIMIT_MAX: '5' } });
		try {
			const [a, b] = [await createUser(limited, 'A'), await createUser(limited, 'B')];
			const codes = [];
			for (let i = 0; i < 6; i++)
				codes.push((await call(limited, 'GET', '/me', a)).statusCode);
			expect(codes).toEqual([200, 200, 200, 200, 200, 429]);
			// Another user on the same address keeps their own budget.
			expect((await call(limited, 'GET', '/me', b)).statusCode).toBe(200);
			const blocked = await call(limited, 'GET', '/me', a);
			expect(blocked.json().error.code).toBe('RATE_LIMITED');
			expect(blocked.headers['retry-after']).toBeDefined();
		} finally {
			await closeTestApp(limited);
		}
	});

	it('limits login attempts per address, whatever the email', async () => {
		const limited = await buildTestApp({ env: { AUTH_RATE_LIMIT_MAX: '3' } });
		try {
			const codes = [];
			for (let i = 0; i < 4; i++) {
				const res = await call(limited, 'POST', '/auth/login', null, {
					email: `nobody-${i}@test.local`,
					password: PASSWORD,
				});
				codes.push(res.statusCode);
			}
			expect(codes).toEqual([401, 401, 401, 429]);
		} finally {
			await closeTestApp(limited);
		}
	});
});

describe('login backoff', () => {
	const attempt = (email: string, password: string) =>
		call(t, 'POST', '/auth/login', null, { email, password });

	it('locks an email after repeated failures, even with the right password', async () => {
		const user = await createUser(t);
		for (let i = 0; i < 5; i++) {
			expect((await attempt(user.email, 'wrong-password1')).statusCode).toBe(401);
		}
		const locked = await attempt(user.email, PASSWORD);
		expect(locked.statusCode).toBe(429);
		expect(locked.json().error.code).toBe('RATE_LIMITED');
		expect(Number(locked.headers['retry-after'])).toBeGreaterThan(0);
	});

	it('answers the same for an unknown email', async () => {
		const email = 'ghost-backoff@test.local';
		for (let i = 0; i < 5; i++)
			expect((await attempt(email, 'whatever12')).statusCode).toBe(401);
		expect((await attempt(email, 'whatever12')).statusCode).toBe(429);
	});

	it('a successful login clears the count', async () => {
		const user = await createUser(t);
		for (let i = 0; i < 4; i++) await attempt(user.email, 'wrong-password1');
		expect((await attempt(user.email, PASSWORD)).statusCode).toBe(200);
		for (let i = 0; i < 4; i++) await attempt(user.email, 'wrong-password1');
		expect((await attempt(user.email, PASSWORD)).statusCode).toBe(200);
	});
});

// How each route is expected to treat somebody who has nothing to do with the data.
//   public  — no token needed
//   open    — any logged-in user; answers only their own or public data
//   guarded — addresses somebody's resource: a stranger gets 403 or 404
type Rule = { as: 'public' | 'open' | 'guarded'; body?: object };
const ZERO = '00000000-0000-4000-8000-000000000000';
const RULES: Record<string, Rule> = {
	'GET /health': { as: 'public' },
	'POST /auth/register': { as: 'public' },
	'POST /auth/verify-email': { as: 'public' },
	'POST /auth/resend-verification': { as: 'public' },
	'POST /auth/login': { as: 'public' },
	'POST /auth/refresh': { as: 'public' },
	'POST /auth/logout': { as: 'public' },
	'POST /auth/forgot-password': { as: 'public' },
	'POST /auth/reset-password': { as: 'public' },
	'POST /auth/google': { as: 'public' },
	'POST /auth/facebook': { as: 'public' },
	'GET /me': { as: 'open' },
	'PATCH /me': { as: 'open' },
	'PUT /me/password': { as: 'open' },
	'POST /me/link/google': { as: 'open' },
	'POST /me/link/facebook': { as: 'open' },
	'DELETE /me/link/{provider}': { as: 'open' },
	'GET /users': { as: 'open' },
	'GET /users/{id}': { as: 'open' },
	'GET /friends': { as: 'open' },
	'GET /friends/requests': { as: 'open' },
	'POST /friends/requests': { as: 'open' },
	'POST /friends/requests/{id}/accept': { as: 'guarded' },
	'DELETE /friends/requests/{id}': { as: 'guarded' },
	'DELETE /friends/{id}': { as: 'guarded' },
	'GET /tracks/search': { as: 'open' },
	'GET /tracks/{deezerId}': { as: 'open' },
	'GET /genres': { as: 'open' },
	'GET /events': { as: 'open' },
	'POST /events': { as: 'open' },
	'GET /events/{id}': { as: 'guarded' },
	'PATCH /events/{id}': { as: 'guarded', body: { name: 'Taken over' } },
	'DELETE /events/{id}': { as: 'guarded' },
	'GET /events/{id}/invites': { as: 'guarded' },
	'POST /events/{id}/invites': { as: 'guarded', body: { userId: ZERO } },
	'DELETE /events/{id}/invites/{userId}': { as: 'guarded' },
	'GET /events/{id}/state': { as: 'guarded' },
	'POST /events/{id}/tracks': { as: 'guarded', body: { deezerId: 1 } },
	'POST /events/{id}/tracks/{entryId}/vote': { as: 'guarded', body: {} },
	'DELETE /events/{id}/tracks/{entryId}/vote': { as: 'guarded' },
	'POST /events/{id}/next': { as: 'guarded', body: { currentEntryId: null } },
	'GET /playlists': { as: 'open' },
	'POST /playlists': { as: 'open' },
	'GET /playlists/{id}': { as: 'guarded' },
	'PATCH /playlists/{id}': { as: 'guarded', body: { name: 'Taken over' } },
	'DELETE /playlists/{id}': { as: 'guarded' },
	'GET /playlists/{id}/members': { as: 'guarded' },
	'POST /playlists/{id}/members': { as: 'guarded', body: { userId: ZERO } },
	'DELETE /playlists/{id}/members/{userId}': { as: 'guarded' },
	'GET /playlists/{id}/entries': { as: 'guarded' },
	'POST /playlists/{id}/entries': { as: 'guarded', body: { deezerId: 1 } },
	'PATCH /playlists/{id}/entries/{entryId}': { as: 'guarded', body: { afterEntryId: null } },
	'DELETE /playlists/{id}/entries/{entryId}': { as: 'guarded' },
	'GET /devices': { as: 'open' },
	'GET /devices/controllable': { as: 'open' },
	'PATCH /devices/{id}': { as: 'guarded', body: { name: 'Taken over' } },
	'DELETE /devices/{id}': { as: 'guarded' },
	'PUT /devices/{id}/grants/{userId}': { as: 'guarded', body: {} },
	'DELETE /devices/{id}/grants/{userId}': { as: 'guarded' },
};

describe('authorization audit: every route as a stranger', () => {
	const SECRET = 'zq-secret';
	let victim: TestUser;
	let stranger: TestUser;
	let ids: Record<string, string>;
	let routes: { key: string; method: string; path: string }[];

	beforeAll(async () => {
		victim = await createUser(t, `Victim`, `${SECRET}-device`);
		stranger = await createUser(t, 'Stranger');
		await call(t, 'PATCH', '/me', victim, {
			friendsInfo: { bio: `${SECRET}-friends` },
			privateInfo: { phone: `${SECRET}-private` },
		});
		const event = (
			await call(t, 'POST', '/events', victim, {
				name: `${SECRET}-event`,
				visibility: 'PRIVATE',
			})
		).json();
		await call(t, 'POST', `/events/${event.id}/tracks`, victim, { deezerId: 7001 });
		const queued = (
			await call(t, 'POST', `/events/${event.id}/tracks`, victim, { deezerId: 7002 })
		).json();
		const playlist = (
			await call(t, 'POST', '/playlists', victim, {
				name: `${SECRET}-playlist`,
				visibility: 'PRIVATE',
			})
		).json();
		const entries = (
			await call(t, 'POST', `/playlists/${playlist.id}/entries`, victim, { deezerId: 7003 })
		).json();
		const device = await t.prisma.device.findFirstOrThrow({ where: { userId: victim.id } });
		ids = {
			events: event.id,
			playlists: playlist.id,
			devices: device.id,
			eventEntry: queued.queue[0].id,
			playlistEntry: entries.entries[0].id,
		};

		const paths = (t.app.swagger() as { paths: Record<string, Record<string, unknown>> }).paths;
		routes = Object.entries(paths).flatMap(([full, methods]) =>
			Object.keys(methods).map((method) => {
				const path = full.replace('/api/v1', '');
				return {
					key: `${method.toUpperCase()} ${path}`,
					method: method.toUpperCase(),
					path,
				};
			}),
		);
	});

	// Path parameters point at the victim's resources.
	const fill = (path: string) => {
		const root = path.split('/')[1]!;
		return path
			.replace('{id}', ids[root] ?? victim.id)
			.replace('{entryId}', root === 'events' ? ids.eventEntry! : ids.playlistEntry!)
			.replace('{userId}', victim.id)
			.replace('{deezerId}', '7001')
			.replace('{provider}', 'google');
	};
	const query = (path: string) => (path === '/users' || path === '/tracks/search' ? '?q=v' : '');

	it('has a rule for every route, and no rule for a route that is gone', () => {
		expect(routes.length).toBeGreaterThan(50);
		expect(routes.map((r) => r.key).sort()).toEqual(Object.keys(RULES).sort());
	});

	it('answers 401 without a token everywhere but on the public routes', async () => {
		for (const { key, method, path } of routes) {
			if (RULES[key]?.as === 'public') continue;
			const res = await call(
				t,
				method as 'GET',
				fill(path) + query(path),
				null,
				RULES[key]?.body,
			);
			expect(res.statusCode, key).toBe(401);
		}
	});

	it('answers 403 or 404 on somebody else resources and never shows their data', async () => {
		for (const { key, method, path } of routes) {
			const rule = RULES[key];
			if (!rule || rule.as === 'public') continue;
			// Open routes that write only touch the caller's own data: reads are enough.
			if (rule.as === 'open' && method !== 'GET') continue;
			const res = await call(
				t,
				method as 'GET',
				fill(path) + query(path),
				stranger,
				rule.body,
			);
			if (rule.as === 'guarded') expect([403, 404], key).toContain(res.statusCode);
			else expect(res.statusCode, key).toBe(200);
			expect(res.body, key).not.toContain(SECRET);
			expect(res.body, key).not.toContain(victim.email);
		}
	});

	it('left the victim data untouched', async () => {
		expect((await call(t, 'GET', `/events/${ids.events}`, victim)).json().name).toBe(
			`${SECRET}-event`,
		);
		expect((await call(t, 'GET', `/playlists/${ids.playlists}`, victim)).json().name).toBe(
			`${SECRET}-playlist`,
		);
		expect(await t.prisma.device.count({ where: { id: ids.devices } })).toBe(1);
	});
});
