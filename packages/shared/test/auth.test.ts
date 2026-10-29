import { describe, expect, it } from 'vitest';
import {
	ChangePasswordBody,
	EmailBody,
	LoginBody,
	MeResponse,
	Password,
	PASSWORD_MAX,
	RefreshBody,
	RegisterBody,
	ResetBody,
	TokenPair,
	VerifyBody,
} from '../src/index.js';

describe('Password policy', () => {
	it.each(['abcdef12', 'Passw0rd!', 'ñandú2026'])('accepts %s', (pw) => {
		expect(Password.safeParse(pw).success).toBe(true);
	});

	it.each([
		['too short', 'abc123'],
		['digits only', '12345678'],
		['no digit', 'abcdefgh'],
		['too long', `a1${'x'.repeat(PASSWORD_MAX)}`],
	])('rejects %s', (_label, pw) => {
		expect(Password.safeParse(pw).success).toBe(false);
	});
});

describe('RegisterBody', () => {
	const valid = { email: 'Ana@Example.COM ', password: 'abcdef12', displayName: ' Ana ' };

	it('normalises email and display name', () => {
		expect(RegisterBody.parse(valid)).toEqual({
			email: 'ana@example.com',
			password: 'abcdef12',
			displayName: 'Ana',
		});
	});

	it('rejects an invalid email', () => {
		expect(RegisterBody.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false);
	});

	it('rejects a blank display name', () => {
		expect(RegisterBody.safeParse({ ...valid, displayName: '   ' }).success).toBe(false);
	});

	it('rejects a weak password', () => {
		expect(RegisterBody.safeParse({ ...valid, password: '12345678' }).success).toBe(false);
	});

	it('rejects unknown keys', () => {
		expect(RegisterBody.safeParse({ ...valid, admin: true }).success).toBe(false);
	});
});

describe('LoginBody', () => {
	it('does not apply the password policy (old passwords still log in)', () => {
		expect(LoginBody.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
	});

	it('rejects an empty password', () => {
		expect(LoginBody.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
	});
});

describe('token bodies', () => {
	it('VerifyBody and RefreshBody need a non-empty token', () => {
		expect(VerifyBody.safeParse({ token: '' }).success).toBe(false);
		expect(RefreshBody.safeParse({ refreshToken: '' }).success).toBe(false);
		expect(VerifyBody.safeParse({ token: 'abc' }).success).toBe(true);
	});

	it('ResetBody applies the password policy', () => {
		expect(ResetBody.safeParse({ token: 't', password: '12345678' }).success).toBe(false);
		expect(ResetBody.safeParse({ token: 't', password: 'abcdef12' }).success).toBe(true);
	});

	it('ChangePasswordBody applies the policy to the new password only', () => {
		expect(
			ChangePasswordBody.safeParse({ currentPassword: 'x', newPassword: 'abcdef12' }).success,
		).toBe(true);
		expect(
			ChangePasswordBody.safeParse({ currentPassword: 'x', newPassword: 'short' }).success,
		).toBe(false);
	});

	it('EmailBody normalises the email', () => {
		expect(EmailBody.parse({ email: ' A@B.CO' })).toEqual({ email: 'a@b.co' });
	});
});

describe('responses', () => {
	it('TokenPair', () => {
		expect(
			TokenPair.safeParse({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 }).success,
		).toBe(true);
	});

	it('MeResponse', () => {
		const me = {
			id: '0b7c6f1e-2f4a-4c1a-9d5e-3a1b2c3d4e5f',
			email: 'a@b.co',
			displayName: 'Ana',
		};
		expect(MeResponse.safeParse(me).success).toBe(true);
		expect(MeResponse.safeParse({ ...me, id: 'nope' }).success).toBe(false);
	});
});
