import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';

import LinkedAccountsScreen from '../app/linked-accounts';
import { queryClient } from '@/api/query-client';
import { useSession } from '@/stores/session';
import { ME, reply } from './fixtures';

const LINKED = { ...ME, hasPassword: false, providers: ['google'] };

beforeEach(async () => {
	queryClient.clear();
	await useSession.getState().signIn({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
});

const renderScreen = () =>
	render(
		<QueryClientProvider client={queryClient}>
			<LinkedAccountsScreen />
		</QueryClientProvider>,
	);

describe('LinkedAccountsScreen', () => {
	it('shows which providers are linked', async () => {
		globalThis.fetch = jest.fn().mockResolvedValue(reply(200, LINKED));
		await renderScreen();
		expect(await screen.findByText('Google: linked')).toBeOnTheScreen();
		expect(screen.getByText('Facebook: not linked')).toBeOnTheScreen();
		expect(screen.getByText(/Password: not set/)).toBeOnTheScreen();
	});

	it('explains why the last login method cannot be unlinked', async () => {
		globalThis.fetch = jest
			.fn()
			.mockResolvedValueOnce(reply(200, LINKED))
			.mockResolvedValueOnce(
				reply(409, { error: { code: 'LAST_LOGIN_METHOD', message: 'x' } }),
			);
		await renderScreen();
		await fireEvent.press(await screen.findByText('Unlink Google'));
		expect(
			await screen.findByText(
				'Set a password or link another account before unlinking this one',
			),
		).toBeOnTheScreen();
	});
});
