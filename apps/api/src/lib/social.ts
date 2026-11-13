import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { type Provider, SocialErrorCode } from '@music-room/shared';
import type { Env } from '../config/env.js';
import { httpError } from '../plugins/errors.js';

// Identity confirmed by the provider; email is null when the provider has none.
export type SocialProfile = { providerId: string; email: string | null; name: string };
export type SocialVerifier = Record<Provider, (token: string) => Promise<SocialProfile>>;

const GRAPH = 'https://graph.facebook.com/v19.0';
const TIMEOUT_MS = 5000;

export const invalidSocialToken = () =>
	httpError(401, SocialErrorCode.InvalidSocialToken, 'The provider refused this sign-in');
const disabled = (provider: Provider) =>
	httpError(503, SocialErrorCode.SocialDisabled, `${provider} sign-in is not configured`);

const FbDebug = z.object({
	data: z.object({ app_id: z.string(), is_valid: z.boolean(), user_id: z.string() }),
});
const FbMe = z.object({ id: z.string(), name: z.string(), email: z.email().optional() });

async function graph<T>(path: string, schema: z.ZodType<T>): Promise<T> {
	const res = await fetch(`${GRAPH}${path}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
	const body = schema.safeParse(await res.json().catch(() => null));
	if (!res.ok || !body.success) throw invalidSocialToken();
	return body.data;
}

export function createSocialVerifier(env: Env): SocialVerifier {
	const google = new OAuth2Client();

	return {
		google: async (idToken) => {
			if (env.GOOGLE_CLIENT_IDS.length === 0) throw disabled('google');
			const payload = await google
				.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_IDS })
				.then((ticket) => ticket.getPayload())
				.catch(() => undefined);
			if (!payload?.sub || !payload.email || !payload.email_verified) {
				throw invalidSocialToken();
			}
			return {
				providerId: payload.sub,
				email: payload.email.toLowerCase(),
				name: payload.name ?? payload.email.split('@')[0] ?? 'User',
			};
		},
		facebook: async (accessToken) => {
			const { FACEBOOK_APP_ID: appId, FACEBOOK_APP_SECRET: secret } = env;
			if (!appId || !secret) throw disabled('facebook');
			const token = encodeURIComponent(accessToken);
			const debug = await graph(
				`/debug_token?input_token=${token}&access_token=${appId}|${secret}`,
				FbDebug,
			);
			if (!debug.data.is_valid || debug.data.app_id !== appId) throw invalidSocialToken();
			// Facebook only returns confirmed emails.
			const me = await graph(`/me?fields=id,name,email&access_token=${token}`, FbMe);
			if (me.id !== debug.data.user_id) throw invalidSocialToken();
			return { providerId: me.id, email: me.email?.toLowerCase() ?? null, name: me.name };
		},
	};
}
