import { describe, expect, it } from 'vitest';
import { ProfileInfo, UpdateMeBody, UserProfile } from '../src/index.js';

const base = {
	id: '0b7c6f1e-2f4a-4c1a-9d5e-3a1b2c3d4e5f',
	displayName: 'Ana',
	relation: 'none',
	publicInfo: { city: 'Madrid' },
	musicPrefs: ['jazz'],
};

describe('ProfileInfo', () => {
	it('accepts known fields, empty strings included', () => {
		expect(ProfileInfo.safeParse({ bio: 'hi', birthday: '' }).success).toBe(true);
		expect(ProfileInfo.safeParse({ birthday: '2000-01-31' }).success).toBe(true);
	});

	it('rejects unknown fields and bad dates', () => {
		expect(ProfileInfo.safeParse({ secret: 'x' }).success).toBe(false);
		expect(ProfileInfo.safeParse({ birthday: '31/01/2000' }).success).toBe(false);
	});
});

describe('UserProfile', () => {
	it('strips friend and private tiers from a public view', () => {
		const parsed = UserProfile.parse({ ...base, privateInfo: { phone: '1' } });
		expect(parsed).not.toHaveProperty('privateInfo');
		expect(parsed).not.toHaveProperty('friendsInfo');
	});

	it('keeps friendsInfo for a friend view, but never privateInfo without email', () => {
		const parsed = UserProfile.parse({
			...base,
			relation: 'friend',
			friendsInfo: { bio: 'x' },
			privateInfo: { phone: '1' },
		});
		expect(parsed).toHaveProperty('friendsInfo');
		expect(parsed).not.toHaveProperty('privateInfo');
	});
});

describe('UpdateMeBody', () => {
	it('limits music preferences', () => {
		const many = Array.from({ length: 21 }, (_, i) => `g${i}`);
		expect(UpdateMeBody.safeParse({ musicPrefs: many }).success).toBe(false);
		expect(UpdateMeBody.safeParse({ musicPrefs: ['rock'] }).success).toBe(true);
	});
});
