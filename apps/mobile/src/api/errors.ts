import { ErrorBody } from '@music-room/shared';

export class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		message: string,
		// Full error body, for answers that carry more than the message (409 STALE + state).
		readonly body?: unknown,
	) {
		super(message);
	}
}

// A failure whose message is already meant for the user (permission denied…).
export class UserError extends Error {}

export async function toApiError(res: Response): Promise<ApiError> {
	const raw: unknown = await res.json().catch(() => null);
	const body = ErrorBody.safeParse(raw);
	return body.success
		? new ApiError(res.status, body.data.error.code, body.data.error.message, raw)
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
	CANNOT_VOTE: 'You cannot vote in this event',
	LOCATION_REQUIRED: 'Share your location to vote here',
	OUTSIDE_ZONE: 'You are too far from the event to vote',
	OUTSIDE_WINDOW: 'Voting is closed right now',
	NO_PREVIEW: 'This track has no preview, pick another one',
	STALE: 'Things changed meanwhile, the list is up to date now',
	CANNOT_EDIT: 'Only invited members can edit this playlist',
	CATALOG_BUSY: 'The music catalog is busy, try again in a few seconds',
};

// Text shown to the user for any failed call.
export function errorMessage(err: unknown): string {
	if (err instanceof ApiError) return MESSAGES[err.code] ?? err.message;
	if (err instanceof UserError) return err.message;
	return "Can't reach the server. Check the address in Settings.";
}
