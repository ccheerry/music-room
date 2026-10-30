import { z } from 'zod';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

export const Email = z.string().trim().toLowerCase().max(254).pipe(z.email());

export const Password = z
	.string()
	.min(PASSWORD_MIN, `At least ${PASSWORD_MIN} characters`)
	.max(PASSWORD_MAX, `At most ${PASSWORD_MAX} characters`)
	.regex(/\p{L}/u, 'At least one letter')
	.regex(/\d/, 'At least one digit');

const Token = z.string().min(1).max(256);

export const RegisterBody = z.strictObject({
	email: Email,
	password: Password,
	displayName: z.string().trim().min(1).max(50),
});
export type RegisterBody = z.infer<typeof RegisterBody>;

// No policy here: accounts created under an older policy must still log in.
export const LoginBody = z.strictObject({
	email: Email,
	password: z.string().min(1).max(PASSWORD_MAX),
});
export type LoginBody = z.infer<typeof LoginBody>;

// Forgot password and resend verification.
export const EmailBody = z.strictObject({ email: Email });
export type EmailBody = z.infer<typeof EmailBody>;

export const VerifyBody = z.strictObject({ token: Token });
export type VerifyBody = z.infer<typeof VerifyBody>;

export const ResetBody = z.strictObject({ token: Token, password: Password });
export type ResetBody = z.infer<typeof ResetBody>;

// Refresh and logout.
export const RefreshBody = z.strictObject({ refreshToken: Token });
export type RefreshBody = z.infer<typeof RefreshBody>;

export const ChangePasswordBody = z.strictObject({
	currentPassword: z.string().min(1).max(PASSWORD_MAX),
	newPassword: Password,
});
export type ChangePasswordBody = z.infer<typeof ChangePasswordBody>;

export const TokenPair = z.object({
	accessToken: z.string(),
	refreshToken: z.string(),
	expiresIn: z.number().int().positive(),
});
export type TokenPair = z.infer<typeof TokenPair>;

export const MeResponse = z.object({
	id: z.uuid(),
	email: z.email(),
	displayName: z.string(),
});
export type MeResponse = z.infer<typeof MeResponse>;

export const AuthErrorCode = {
	InvalidCredentials: 'INVALID_CREDENTIALS',
	EmailNotVerified: 'EMAIL_NOT_VERIFIED',
	InvalidToken: 'INVALID_TOKEN',
	Unauthorized: 'UNAUTHORIZED',
} as const;
