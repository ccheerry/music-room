import { renderRouter, screen } from 'expo-router/testing-library';

import { useSession } from '@/stores/session';

// Relative to the Jest root (apps/mobile).
const APP = './app';

beforeEach(() => {
	globalThis.fetch = jest.fn().mockResolvedValue({
		status: 200,
		json: async () => ({
			id: '0b7c6f1e-2f4a-4c1a-9d5e-3a1b2c3d4e5f',
			email: 'a@b.co',
			displayName: 'Ana',
		}),
	});
});

describe('auth gate', () => {
	it('opens on Welcome when signed out', async () => {
		await useSession.getState().signOut();
		const app = await renderRouter(APP, { initialUrl: '/' });
		expect(await screen.findByText('Create an account')).toBeOnTheScreen();
		expect(app.getPathname()).toBe('/welcome');
	});

	it('opens on Home when a session is stored', async () => {
		await useSession.getState().signIn({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
		const app = await renderRouter(APP, { initialUrl: '/log-in' });
		expect(await screen.findByText('Hi, Ana')).toBeOnTheScreen();
		expect(app.getPathname()).toBe('/');
	});
});
