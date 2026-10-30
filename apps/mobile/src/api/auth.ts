import {
	type ChangePasswordBody,
	type EmailBody,
	type LoginBody,
	MeResponse,
	type RegisterBody,
	type ResetBody,
	TokenPair,
} from '@music-room/shared';

import { request } from '@/api/client';
import { queryClient } from '@/api/query-client';
import { useSession } from '@/stores/session';

const post = <T = void>(path: string, body: unknown, schema?: Parameters<typeof request<T>>[2]) =>
	request<T>(path, { method: 'POST', body }, schema);

export const register = (body: RegisterBody) => post('/auth/register', body);
export const verifyEmail = (token: string) => post('/auth/verify-email', { token });
export const resendVerification = (body: EmailBody) => post('/auth/resend-verification', body);
export const forgotPassword = (body: EmailBody) => post('/auth/forgot-password', body);
export const resetPassword = (body: ResetBody) => post('/auth/reset-password', body);

export async function logIn(body: LoginBody): Promise<void> {
	await useSession.getState().signIn(await post('/auth/login', body, TokenPair));
}

export async function logOut(): Promise<void> {
	const { refreshToken, signOut } = useSession.getState();
	await signOut();
	queryClient.clear();
	// Best effort: offline, the server-side session simply expires.
	if (refreshToken) await post('/auth/logout', { refreshToken }).catch(() => undefined);
}

export const getMe = () => request('/me', { auth: true }, MeResponse);

export const changePassword = (body: ChangePasswordBody) =>
	request('/me/password', { method: 'PUT', body, auth: true });
