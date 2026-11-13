import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
	buildTestApp,
	call,
	closeTestApp,
	createUser,
	tokenFrom,
	uniqueEmail,
	type TestApp,
	type TestUser,
} from './helpers.js';

let t: TestApp;

beforeAll(async () => {
	t = await buildTestApp();
});

afterAll(() => closeTestApp(t));

const token = (email: string | null = uniqueEmail(), id = randomUUID()) =>
	`${id}|${email ?? ''}|Social User`;

const google = (idToken: string) => call(t, 'POST', '/auth/google', null, { idToken });
const facebook = (accessToken: string) => call(t, 'POST', '/auth/facebook', null, { accessToken });
const me = (user: TestUser) => call(t, 'GET', '/me', user).then((r) => r.json());
const bearer = (accessToken: string) => ({
	id: '',
	email: '',
	tokens: { accessToken, refreshToken: '', expiresIn: 0 },
	auth: { authorization: `Bearer ${accessToken}` },
});

describe('social sign-in', () => {
	it('creates a verified, password-less user on first Google sign-in', async () => {
		const email = uniqueEmail();
		const res = await google(token(email));
		expect(res.statusCode).toBe(200);

		const profile = await me(bearer(res.json().accessToken));
		expect(profile).toMatchObject({ email, hasPassword: false, providers: ['google'] });
		const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
		expect(user.emailVerifiedAt).not.toBeNull();
	});

	it('logs the same provider account back into the same user', async () => {
		const tok = token();
		const first = await me(bearer((await facebook(tok)).json().accessToken));
		const again = await me(bearer((await facebook(tok)).json().accessToken));
		expect(again.id).toBe(first.id);
	});

	it('refuses to merge silently into an existing email account', async () => {
		const user = await createUser(t);
		const res = await google(token(user.email));
		expect(res.statusCode).toBe(409);
		expect(res.json().error.code).toBe('ACCOUNT_EXISTS');
	});

	it('needs an email from the provider to sign up', async () => {
		const res = await facebook(token(null));
		expect(res.statusCode).toBe(400);
		expect(res.json().error.code).toBe('EMAIL_REQUIRED');
	});

	it('refuses a token the provider rejects', async () => {
		const res = await google('garbage');
		expect(res.statusCode).toBe(401);
		expect(res.json().error.code).toBe('INVALID_SOCIAL_TOKEN');
	});
});

describe('linking', () => {
	it('links Google to an email account, then Google logs into it', async () => {
		const user = await createUser(t);
		const tok = token(uniqueEmail());
		expect((await call(t, 'POST', '/me/link/google', user, { idToken: tok })).statusCode).toBe(
			204,
		);
		expect((await me(user)).providers).toEqual(['google']);

		const res = await google(tok);
		expect(res.statusCode).toBe(200);
		expect((await me(bearer(res.json().accessToken))).id).toBe(user.id);
	});

	it('is idempotent for the same user and refused for another one', async () => {
		const [a, b] = [await createUser(t), await createUser(t)];
		const tok = token();
		await call(t, 'POST', '/me/link/facebook', a, { accessToken: tok });
		const again = await call(t, 'POST', '/me/link/facebook', a, { accessToken: tok });
		expect(again.statusCode).toBe(204);

		const other = await call(t, 'POST', '/me/link/facebook', b, { accessToken: tok });
		expect(other.statusCode).toBe(409);
		expect(other.json().error.code).toBe('PROVIDER_IN_USE');
	});

	it('refuses a second account of the same provider', async () => {
		const user = await createUser(t);
		await call(t, 'POST', '/me/link/google', user, { idToken: token() });
		const res = await call(t, 'POST', '/me/link/google', user, { idToken: token() });
		expect(res.statusCode).toBe(409);
	});

	it('requires authentication', async () => {
		const res = await call(t, 'POST', '/me/link/google', null, { idToken: token() });
		expect(res.statusCode).toBe(401);
	});
});

describe('unlinking', () => {
	it('unlinks when a password remains', async () => {
		const user = await createUser(t);
		await call(t, 'POST', '/me/link/google', user, { idToken: token() });
		expect((await call(t, 'DELETE', '/me/link/google', user)).statusCode).toBe(204);
		expect((await me(user)).providers).toEqual([]);
	});

	it('refuses to remove the only way to log in', async () => {
		const social = bearer((await google(token())).json().accessToken);
		const res = await call(t, 'DELETE', '/me/link/google', social);
		expect(res.statusCode).toBe(409);
		expect(res.json().error.code).toBe('LAST_LOGIN_METHOD');
	});

	it('answers 404 for a provider that is not linked', async () => {
		const user = await createUser(t);
		expect((await call(t, 'DELETE', '/me/link/facebook', user)).statusCode).toBe(404);
	});

	it('lets a social-only user set a password with forgot-password', async () => {
		const email = uniqueEmail();
		await google(token(email));
		await call(t, 'POST', '/auth/forgot-password', null, { email });
		const reset = await call(t, 'POST', '/auth/reset-password', null, {
			token: tokenFrom(t.mails, email, 'reset'),
			password: 'newpass123',
		});
		expect(reset.statusCode).toBe(204);
		const login = await call(t, 'POST', '/auth/login', null, { email, password: 'newpass123' });
		expect(login.statusCode).toBe(200);
		expect((await me(bearer(login.json().accessToken))).hasPassword).toBe(true);
	});
});
