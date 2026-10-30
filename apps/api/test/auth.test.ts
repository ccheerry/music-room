import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TokenPair } from '@music-room/shared';
import { buildTestApp, closeTestApp, tokenFrom, uniqueEmail, type TestApp } from './helpers.js';

const PASSWORD = 'abcdef12';
const CLIENT = { 'x-platform': 'ios', 'x-device': 'iPhone 15', 'x-app-version': '1.0.0' };

let t: TestApp;

beforeAll(async () => {
	t = await buildTestApp();
});

afterAll(() => closeTestApp(t));

const post = (url: string, payload: object, headers: Record<string, string> = CLIENT) =>
	t.app.inject({ method: 'POST', url: `/api/v1${url}`, payload, headers });

const bearer = (tokens: TokenPair) => ({ authorization: `Bearer ${tokens.accessToken}` });

async function register(email = uniqueEmail()) {
	const res = await post('/auth/register', { email, password: PASSWORD, displayName: 'Ana' });
	expect(res.statusCode).toBe(204);
	return email;
}

async function registerVerified(email = uniqueEmail()) {
	await register(email);
	const res = await post('/auth/verify-email', { token: tokenFrom(t.mails, email, 'verify') });
	expect(res.statusCode).toBe(204);
	return email;
}

async function login(email: string, password = PASSWORD): Promise<TokenPair> {
	const res = await post('/auth/login', { email, password });
	expect(res.statusCode).toBe(200);
	return res.json();
}

describe('register and verify', () => {
	it('sends a verification mail and refuses login until verified', async () => {
		const email = await register();
		expect(tokenFrom(t.mails, email, 'verify')).toBeTruthy();

		const res = await post('/auth/login', { email, password: PASSWORD });
		expect(res.statusCode).toBe(403);
		expect(res.json().error.code).toBe('EMAIL_NOT_VERIFIED');
	});

	it('verifies once, then the token is spent', async () => {
		const email = await register();
		const token = tokenFrom(t.mails, email, 'verify');
		expect((await post('/auth/verify-email', { token })).statusCode).toBe(204);

		const again = await post('/auth/verify-email', { token });
		expect(again.statusCode).toBe(400);
		expect(again.json().error.code).toBe('INVALID_TOKEN');
		await login(email);
	});

	it('answers the same for an existing email and warns its owner by mail', async () => {
		const email = await registerVerified();
		const before = t.mails.length;
		await register(email);
		expect(t.mails.length).toBe(before + 1);
		expect(t.mails.at(-1)?.to).toBe(email);
		expect(t.mails.at(-1)?.text).not.toContain('token=');
	});

	it('resends a verification mail only to unverified accounts', async () => {
		const email = await register();
		const before = t.mails.length;
		expect((await post('/auth/resend-verification', { email })).statusCode).toBe(204);
		expect(t.mails.length).toBe(before + 1);

		const unknown = await post('/auth/resend-verification', { email: uniqueEmail() });
		expect(unknown.statusCode).toBe(204);
		expect(t.mails.length).toBe(before + 1);
	});

	it('rejects a weak password with the error envelope', async () => {
		const res = await post('/auth/register', {
			email: uniqueEmail(),
			password: '12345678',
			displayName: 'Ana',
		});
		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe('VALIDATION_ERROR');
	});
});

describe('login', () => {
	it('gives the same answer for a wrong password and an unknown email', async () => {
		const email = await registerVerified();
		const wrong = await post('/auth/login', { email, password: 'wrongpass1' });
		const unknown = await post('/auth/login', { email: uniqueEmail(), password: PASSWORD });
		expect(wrong.statusCode).toBe(401);
		expect(unknown.statusCode).toBe(401);
		expect(wrong.json()).toEqual(unknown.json());
		expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS');
	});

	it('returns tokens that open GET /me', async () => {
		const email = await registerVerified();
		const tokens = await login(email.toUpperCase());
		expect(tokens.expiresIn).toBe(900);

		const me = await t.app.inject({
			method: 'GET',
			url: '/api/v1/me',
			headers: bearer(tokens),
		});
		expect(me.statusCode).toBe(200);
		expect(me.json()).toMatchObject({ email, displayName: 'Ana' });
	});

	it('refuses GET /me without a valid token', async () => {
		const none = await t.app.inject({ method: 'GET', url: '/api/v1/me' });
		expect(none.statusCode).toBe(401);
		expect(none.json().error.code).toBe('UNAUTHORIZED');

		const forged = await t.app.inject({
			method: 'GET',
			url: '/api/v1/me',
			headers: { authorization: 'Bearer not.a.jwt' },
		});
		expect(forged.statusCode).toBe(401);
	});

	it('registers one device per platform and model', async () => {
		const email = await registerVerified();
		await login(email);
		await login(email);
		const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
		const devices = await t.prisma.device.findMany({ where: { userId: user.id } });
		expect(devices).toHaveLength(1);
		expect(devices[0]).toMatchObject({
			platform: 'ios',
			model: 'iPhone 15',
			appVersion: '1.0.0',
		});
	});
});

describe('refresh and logout', () => {
	it('rotates the refresh token', async () => {
		const tokens = await login(await registerVerified());
		const res = await post('/auth/refresh', { refreshToken: tokens.refreshToken });
		expect(res.statusCode).toBe(200);
		expect(res.json().refreshToken).not.toBe(tokens.refreshToken);
	});

	it('revokes the whole family when a replaced token is reused', async () => {
		const first = await login(await registerVerified());
		const second: TokenPair = (
			await post('/auth/refresh', { refreshToken: first.refreshToken })
		).json();

		const reuse = await post('/auth/refresh', { refreshToken: first.refreshToken });
		expect(reuse.statusCode).toBe(401);
		expect(reuse.json().error.code).toBe('INVALID_TOKEN');

		const legit = await post('/auth/refresh', { refreshToken: second.refreshToken });
		expect(legit.statusCode).toBe(401);
	});

	it('lets only one of two concurrent refreshes with the same token win', async () => {
		const tokens = await login(await registerVerified());
		const results = await Promise.all([
			post('/auth/refresh', { refreshToken: tokens.refreshToken }),
			post('/auth/refresh', { refreshToken: tokens.refreshToken }),
		]);
		expect(results.map((r) => r.statusCode).sort()).toEqual([200, 401]);
	});

	it('logout revokes the session', async () => {
		const tokens = await login(await registerVerified());
		expect((await post('/auth/logout', { refreshToken: tokens.refreshToken })).statusCode).toBe(
			204,
		);
		const res = await post('/auth/refresh', { refreshToken: tokens.refreshToken });
		expect(res.statusCode).toBe(401);
	});

	it('logout with an unknown token still answers 204', async () => {
		expect((await post('/auth/logout', { refreshToken: 'nope' })).statusCode).toBe(204);
	});
});

describe('passwords', () => {
	it('forgot-password answers 204 and mails only existing accounts', async () => {
		const before = t.mails.length;
		expect((await post('/auth/forgot-password', { email: uniqueEmail() })).statusCode).toBe(
			204,
		);
		expect(t.mails.length).toBe(before);
	});

	it('reset sets the new password and logs every session out', async () => {
		const email = await registerVerified();
		const session = await login(email);
		await post('/auth/forgot-password', { email });
		const token = tokenFrom(t.mails, email, 'reset');

		expect(
			(await post('/auth/reset-password', { token, password: 'newpass99' })).statusCode,
		).toBe(204);
		expect(
			(await post('/auth/reset-password', { token, password: 'other999' })).statusCode,
		).toBe(400);
		expect(
			(await post('/auth/refresh', { refreshToken: session.refreshToken })).statusCode,
		).toBe(401);
		expect((await post('/auth/login', { email, password: PASSWORD })).statusCode).toBe(401);
		await login(email, 'newpass99');
	});

	it('changes the password only with the current one', async () => {
		const email = await registerVerified();
		const tokens = await login(email);
		const change = (currentPassword: string) =>
			t.app.inject({
				method: 'PUT',
				url: '/api/v1/me/password',
				headers: bearer(tokens),
				payload: { currentPassword, newPassword: 'newpass99' },
			});

		const wrong = await change('wrongpass1');
		expect(wrong.statusCode).toBe(403);
		expect(wrong.json().error.code).toBe('INVALID_CREDENTIALS');
		expect((await change(PASSWORD)).statusCode).toBe(204);
		await login(email, 'newpass99');
	});
});

describe('rate limit', () => {
	it('limits verification mails per address', async () => {
		const email = await register();
		const codes: number[] = [];
		for (let i = 0; i < 6; i++) {
			codes.push((await post('/auth/resend-verification', { email })).statusCode);
		}
		expect(codes.slice(0, 5)).toEqual([204, 204, 204, 204, 204]);
		const blocked = await post('/auth/resend-verification', { email });
		expect(blocked.statusCode).toBe(429);
		expect(blocked.json().error.code).toBe('RATE_LIMITED');
	});
});

describe('action log', () => {
	it('stores who did what from which device', async () => {
		const email = await registerVerified();
		await login(email);
		const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });

		await vi.waitFor(async () => {
			const rows = await t.prisma.actionLog.findMany({ where: { userId: user.id } });
			expect(rows).toContainEqual(
				expect.objectContaining({
					action: 'POST /api/v1/auth/login',
					status: 200,
					platform: 'ios',
					device: 'iPhone 15',
					appVersion: '1.0.0',
					deviceId: expect.any(String),
				}),
			);
		});
	});
});
