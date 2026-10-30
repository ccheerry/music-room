import { API_PREFIX, HealthResponse, TokenPair } from '@music-room/shared';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { z } from 'zod';

import { ApiError, toApiError } from '@/api/errors';
import { useSession } from '@/stores/session';
import { useSettings } from '@/stores/settings';

const TIMEOUT_MS = 5000;

export const deviceHeaders: Record<string, string> = {
	'X-Platform': Platform.OS,
	'X-Device': Device.modelName ?? 'unknown',
	'X-App-Version': Application.nativeApplicationVersion ?? 'unknown',
};

type ApiInit = Omit<RequestInit, 'headers' | 'signal'> & { headers?: Record<string, string> };

export async function apiFetch(
	path: string,
	init: ApiInit = {},
	baseUrl = useSettings.getState().apiUrl,
): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		return await fetch(`${baseUrl}${API_PREFIX}${path}`, {
			...init,
			headers: { ...deviceHeaders, ...init.headers },
			signal: controller.signal,
		});
	} finally {
		clearTimeout(timer);
	}
}

export type HealthStatus = 'ok' | 'db-down' | 'unreachable';

export async function checkHealth(baseUrl: string): Promise<HealthStatus> {
	try {
		const res = await apiFetch('/health', {}, baseUrl);
		const body = HealthResponse.safeParse(await res.json());
		if (!body.success) return 'unreachable';
		return body.data.db === 'ok' ? 'ok' : 'db-down';
	} catch {
		return 'unreachable';
	}
}

type ApiRequest = {
	method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	body?: unknown;
	auth?: boolean;
};

const send = (path: string, { method = 'GET', body }: ApiRequest, token?: string | null) =>
	apiFetch(path, {
		method,
		body: body === undefined ? undefined : JSON.stringify(body),
		headers: {
			...(body !== undefined && { 'Content-Type': 'application/json' }),
			...(token && { Authorization: `Bearer ${token}` }),
		},
	});

const failed = (res: Response) => res.status >= 400;

async function refreshTokens(): Promise<string> {
	const { refreshToken, signIn, signOut } = useSession.getState();
	if (!refreshToken) {
		await signOut();
		throw new ApiError(401, 'UNAUTHORIZED', 'Signed out');
	}
	const res = await send('/auth/refresh', { method: 'POST', body: { refreshToken } });
	if (res.status === 400 || res.status === 401) {
		await signOut();
		throw await toApiError(res);
	}
	if (failed(res)) throw await toApiError(res);
	const tokens = TokenPair.parse(await res.json());
	await signIn(tokens);
	return tokens.accessToken;
}

// Single flight: concurrent 401s share one refresh, a second one would reuse a spent token.
let inflight: Promise<string> | null = null;
const refreshOnce = () => (inflight ??= refreshTokens().finally(() => (inflight = null)));

export async function request<T = void>(
	path: string,
	init: ApiRequest = {},
	schema?: z.ZodType<T>,
): Promise<T> {
	let res = await send(path, init, init.auth ? useSession.getState().accessToken : null);
	if (init.auth && res.status === 401) res = await send(path, init, await refreshOnce());
	if (failed(res)) throw await toApiError(res);
	return (schema ? schema.parse(await res.json()) : await res.json().catch(() => undefined)) as T;
}
