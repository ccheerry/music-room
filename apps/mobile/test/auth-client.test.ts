import * as SecureStore from 'expo-secure-store';

import { request } from '@/api/client';
import { ApiError } from '@/api/errors';
import { useSession } from '@/stores/session';
import { useSettings } from '@/stores/settings';

type Reply = { status: number; body?: unknown };

const json = ({ status, body }: Reply) => ({ status, json: async () => body ?? null });
const unauthorized: Reply = {
	status: 401,
	body: { error: { code: 'UNAUTHORIZED', message: 'x' } },
};
const pair = { accessToken: 'new-access', refreshToken: 'new-refresh', expiresIn: 900 };

// Answers by path; /me needs the fresh access token.
function server(refresh: Reply) {
	return jest.fn(async (url: string, init: RequestInit) => {
		if (url.endsWith('/auth/refresh')) return json(refresh);
		const auth = (init.headers as Record<string, string>).Authorization;
		return json(
			auth === 'Bearer new-access' ? { status: 200, body: { ok: true } } : unauthorized,
		);
	});
}

beforeEach(async () => {
	useSettings.getState().setApiUrl('http://api.test');
	await useSession.getState().signIn({ accessToken: 'old', refreshToken: 'r1', expiresIn: 900 });
});

describe('authenticated requests', () => {
	it('refreshes once for concurrent 401s and retries each request', async () => {
		const fetchMock = server({ status: 200, body: pair });
		globalThis.fetch = fetchMock as unknown as typeof fetch;

		const results = await Promise.all([
			request('/me', { auth: true }),
			request('/me', { auth: true }),
			request('/me', { auth: true }),
		]);

		expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
		const refreshCalls = fetchMock.mock.calls.filter(([url]) => url.endsWith('/auth/refresh'));
		expect(refreshCalls).toHaveLength(1);
		expect(JSON.parse(refreshCalls[0][1].body as string)).toEqual({ refreshToken: 'r1' });
		expect(useSession.getState().accessToken).toBe('new-access');
		expect(await SecureStore.getItemAsync('refreshToken')).toBe('new-refresh');
	});

	it('signs out when the refresh token is refused', async () => {
		globalThis.fetch = server(unauthorized) as unknown as typeof fetch;

		await expect(request('/me', { auth: true })).rejects.toBeInstanceOf(ApiError);
		expect(useSession.getState().status).toBe('signedOut');
		expect(await SecureStore.getItemAsync('refreshToken')).toBeNull();
	});

	it('keeps the session when the server cannot be reached', async () => {
		globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));

		await expect(request('/me', { auth: true })).rejects.toBeInstanceOf(TypeError);
		expect(useSession.getState().status).toBe('signedIn');
	});

	it('turns error bodies into ApiError with the server code', async () => {
		globalThis.fetch = jest.fn().mockResolvedValue(
			json({
				status: 403,
				body: { error: { code: 'EMAIL_NOT_VERIFIED', message: 'm' } },
			}),
		);
		await expect(request('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({
			status: 403,
			code: 'EMAIL_NOT_VERIFIED',
		});
	});
});

describe('session restore', () => {
	it('is signed in after a restart when a refresh token is stored', async () => {
		useSession.setState({ status: 'loading', accessToken: null, refreshToken: null });
		await useSession.getState().restore();
		expect(useSession.getState()).toMatchObject({ status: 'signedIn', refreshToken: 'r1' });
	});
});
