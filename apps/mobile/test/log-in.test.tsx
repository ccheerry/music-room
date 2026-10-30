import { fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import LogInScreen from '../app/log-in';
import { useSession } from '@/stores/session';

jest.mock('expo-router', () => ({
	router: { replace: jest.fn(), push: jest.fn() },
	Link: ({ children }: { children: React.ReactNode }) => children,
}));

const respond = (status: number, body: unknown) =>
	jest.fn().mockResolvedValue({ status, json: async () => body });

async function fill(email: string, password: string) {
	await fireEvent.changeText(screen.getByLabelText('Email'), email);
	await fireEvent.changeText(screen.getByLabelText('Password'), password);
	await fireEvent.press(screen.getByText('Log in'));
}

beforeEach(async () => {
	jest.clearAllMocks();
	await useSession.getState().signOut();
});

describe('LogInScreen', () => {
	it('validates the form before calling the API', async () => {
		const fetchMock = respond(200, {});
		globalThis.fetch = fetchMock;
		await render(<LogInScreen />);

		await fill('not-an-email', '');

		expect(await screen.findByText('Enter a valid email')).toBeOnTheScreen();
		expect(screen.getByText('Enter your password')).toBeOnTheScreen();
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it('shows the server message for wrong credentials', async () => {
		globalThis.fetch = respond(401, { error: { code: 'INVALID_CREDENTIALS', message: 'x' } });
		await render(<LogInScreen />);

		await fill('ana@test.local', 'wrongpass1');

		expect(await screen.findByText('Wrong email or password')).toBeOnTheScreen();
		expect(useSession.getState().status).toBe('signedOut');
	});

	it('sends an unverified user to the inbox screen', async () => {
		globalThis.fetch = respond(403, { error: { code: 'EMAIL_NOT_VERIFIED', message: 'x' } });
		await render(<LogInScreen />);

		await fill('Ana@Test.local', 'abcdef12');

		await screen.findByText('Log in');
		expect(router.replace).toHaveBeenCalledWith({
			pathname: '/check-inbox',
			params: { email: 'ana@test.local' },
		});
	});

	it('stores the session on success', async () => {
		const tokens = { accessToken: 'a', refreshToken: 'r', expiresIn: 900 };
		globalThis.fetch = respond(200, tokens);
		await render(<LogInScreen />);

		await fill('ana@test.local', 'abcdef12');

		await screen.findByText('Log in');
		expect(useSession.getState()).toMatchObject({ status: 'signedIn', accessToken: 'a' });
	});
});
