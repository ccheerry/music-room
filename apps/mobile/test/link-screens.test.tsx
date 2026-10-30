import { render, screen } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import ResetScreen from '../app/reset';
import VerifyScreen from '../app/verify';

jest.mock('expo-router', () => ({
	router: { replace: jest.fn() },
	useLocalSearchParams: jest.fn(),
}));

const withQuery = (ui: React.ReactElement) => (
	<QueryClientProvider
		client={new QueryClient({ defaultOptions: { queries: { gcTime: Infinity } } })}
	>
		{ui}
	</QueryClientProvider>
);

describe('screens opened from a mail link', () => {
	beforeEach(() => {
		jest.mocked(useLocalSearchParams).mockReturnValue({});
		globalThis.fetch = jest.fn();
	});

	it.each([
		['reset', <ResetScreen key="r" />],
		['verify', <VerifyScreen key="v" />],
	])('%s explains a missing token and calls nothing', async (_name, ui) => {
		await render(withQuery(ui));
		expect(
			screen.getByText('This link is incomplete. Open it again from the mail.'),
		).toBeOnTheScreen();
		expect(globalThis.fetch).not.toHaveBeenCalled();
	});
});
