import { renderRouter, screen } from 'expo-router/testing-library';

import { useSession } from '@/stores/session';
import { ME, reply } from './fixtures';

// Relative to the Jest root (apps/mobile).
const APP = './app';

beforeEach(() => {
	globalThis.fetch = jest.fn().mockResolvedValue(reply(200, ME));
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
		expect(await screen.findByText('New event')).toBeOnTheScreen();
		expect(app.getPathname()).toBe('/');
	});
});
