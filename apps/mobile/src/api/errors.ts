import { ErrorBody } from '@music-room/shared';

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
	) {
		super(message);
	}
}

export async function toApiError(res: Response): Promise<ApiError> {
	const body = ErrorBody.safeParse(await res.json().catch(() => null));
	return body.success
		? new ApiError(res.status, body.data.error.code, body.data.error.message)
		: new ApiError(res.status, 'UNKNOWN', `Request failed (${res.status})`);
}

const MESSAGES: Record<string, string> = {
	INVALID_CREDENTIALS: 'Wrong email or password',
	EMAIL_NOT_VERIFIED: 'Confirm your email first',
	INVALID_TOKEN: 'This link is invalid or has expired',
	RATE_LIMITED: 'Too many attempts, try again later',
	PROVIDER_IN_USE: 'This account is already linked to another user',
	LAST_LOGIN_METHOD: 'Set a password or link another account before unlinking this one',
	EMAIL_REQUIRED: 'Your account at this provider has no email; sign up with email instead',
	INVALID_SOCIAL_TOKEN: 'The sign-in was refused, try again',
	SOCIAL_DISABLED: 'This sign-in method is not available on the server',
};

// Text shown to the user for any failed call.
export function errorMessage(err: unknown): string {
	if (err instanceof ApiError) return MESSAGES[err.code] ?? err.message;
	return "Can't reach the server. Check the address in Settings.";
}
