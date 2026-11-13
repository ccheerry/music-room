import { describe, expect, it } from 'vitest';
import { FacebookAuthBody, GoogleAuthBody, ProviderParams } from '../src/index.js';

describe('social schemas', () => {
	it('requires a provider token', () => {
		expect(GoogleAuthBody.safeParse({ idToken: 'x' }).success).toBe(true);
		expect(GoogleAuthBody.safeParse({ idToken: '' }).success).toBe(false);
		expect(FacebookAuthBody.safeParse({ accessToken: 'x', extra: 1 }).success).toBe(false);
	});

	it('only knows google and facebook', () => {
		expect(ProviderParams.safeParse({ provider: 'google' }).success).toBe(true);
		expect(ProviderParams.safeParse({ provider: 'apple' }).success).toBe(false);
	});
});
