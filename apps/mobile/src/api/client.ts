import { API_PREFIX, HealthResponse } from '@music-room/shared';
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

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
