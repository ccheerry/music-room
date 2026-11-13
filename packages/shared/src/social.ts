import { z } from 'zod';

export const Provider = z.enum(['google', 'facebook']);
export type Provider = z.infer<typeof Provider>;

const ProviderToken = z.string().min(1).max(4096);

export const GoogleAuthBody = z.strictObject({ idToken: ProviderToken });
export type GoogleAuthBody = z.infer<typeof GoogleAuthBody>;

export const FacebookAuthBody = z.strictObject({ accessToken: ProviderToken });
export type FacebookAuthBody = z.infer<typeof FacebookAuthBody>;

export const ProviderParams = z.strictObject({ provider: Provider });
export type ProviderParams = z.infer<typeof ProviderParams>;

export const SocialErrorCode = {
	// Verified email already has an account: log in with it, then link the provider.
	AccountExists: 'ACCOUNT_EXISTS',
	ProviderInUse: 'PROVIDER_IN_USE',
	LastLoginMethod: 'LAST_LOGIN_METHOD',
	EmailRequired: 'EMAIL_REQUIRED',
	InvalidSocialToken: 'INVALID_SOCIAL_TOKEN',
	SocialDisabled: 'SOCIAL_DISABLED',
} as const;
