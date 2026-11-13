import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { createSocialVerifier } from '../src/lib/social.js';

const env = (extra: Record<string, string> = {}) =>
	loadEnv({ ...process.env, GOOGLE_CLIENT_IDS: '', FACEBOOK_APP_ID: '', ...extra });

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('social verifier', () => {
	it('answers 503 when a provider is not configured', async () => {
		const verifier = createSocialVerifier(env());
		await expect(verifier.google('t')).rejects.toMatchObject({ statusCode: 503 });
		await expect(verifier.facebook('t')).rejects.toMatchObject({ statusCode: 503 });
	});

	it('checks the Facebook token belongs to our app, then reads the profile', async () => {
		const fetch = vi
			.fn()
			.mockResolvedValueOnce(json({ data: { app_id: 'app', is_valid: true, user_id: '42' } }))
			.mockResolvedValueOnce(json({ id: '42', name: 'Ana', email: 'Ana@Mail.com' }));
		vi.stubGlobal('fetch', fetch);
		const verifier = createSocialVerifier(
			env({ FACEBOOK_APP_ID: 'app', FACEBOOK_APP_SECRET: 's' }),
		);
		await expect(verifier.facebook('tok')).resolves.toEqual({
			providerId: '42',
			email: 'ana@mail.com',
			name: 'Ana',
		});
	});

	it('refuses a Facebook token issued for another app', async () => {
		vi.stubGlobal(
			'fetch',
			vi
				.fn()
				.mockResolvedValue(json({ data: { app_id: 'x', is_valid: true, user_id: '1' } })),
		);
		const verifier = createSocialVerifier(
			env({ FACEBOOK_APP_ID: 'app', FACEBOOK_APP_SECRET: 's' }),
		);
		await expect(verifier.facebook('tok')).rejects.toMatchObject({ statusCode: 401 });
	});

	it('refuses a Google token that does not verify', async () => {
		const verifier = createSocialVerifier(env({ GOOGLE_CLIENT_IDS: 'id.apps' }));
		await expect(verifier.google('not-a-jwt')).rejects.toMatchObject({ statusCode: 401 });
	});
});
