import { type Provider, TokenPair } from '@music-room/shared';

import { request } from '@/api/client';
import { queryClient } from '@/api/query-client';
import { useSession } from '@/stores/session';

const body = (provider: Provider, token: string) =>
	provider === 'google' ? { idToken: token } : { accessToken: token };

export async function socialLogIn(provider: Provider, token: string): Promise<void> {
	const tokens = await request(
		`/auth/${provider}`,
		{ method: 'POST', body: body(provider, token) },
		TokenPair,
	);
	await useSession.getState().signIn(tokens);
}

export async function linkProvider(provider: Provider, token: string): Promise<void> {
	await request(`/me/link/${provider}`, {
		method: 'POST',
		body: body(provider, token),
		auth: true,
	});
	await queryClient.invalidateQueries({ queryKey: ['me'] });
}

export async function unlinkProvider(provider: Provider): Promise<void> {
	await request(`/me/link/${provider}`, { method: 'DELETE', auth: true });
	await queryClient.invalidateQueries({ queryKey: ['me'] });
}
