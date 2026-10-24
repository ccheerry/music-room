import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsScreen from '../app/settings';
import { DEFAULT_API_URL, useSettings } from '@/stores/settings';

const respond = (status: number, body: unknown) =>
	jest.fn().mockResolvedValue({ status, json: async () => body });

beforeEach(() => {
	useSettings.getState().resetApiUrl();
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('SettingsScreen', () => {
	it('starts with the stored address', async () => {
		await render(<SettingsScreen />);
		expect(screen.getByLabelText('Backend address').props.value).toBe(DEFAULT_API_URL);
	});

	it('reports a healthy backend on Test', async () => {
		const fetchMock = respond(200, { status: 'ok', db: 'ok' });
		globalThis.fetch = fetchMock;
		await render(<SettingsScreen />);

		await fireEvent.changeText(
			screen.getByLabelText('Backend address'),
			'http://10.0.0.5:3000/',
		);
		await fireEvent.press(screen.getByText('Test'));

		expect(await screen.findByText('API ok')).toBeOnTheScreen();
		expect(fetchMock.mock.calls[0][0]).toBe('http://10.0.0.5:3000/api/v1/health');
	});

	it('distinguishes a down database from an unreachable API', async () => {
		globalThis.fetch = respond(503, { status: 'ok', db: 'down' });
		await render(<SettingsScreen />);
		await fireEvent.press(screen.getByText('Test'));
		expect(await screen.findByText('API up, database down')).toBeOnTheScreen();

		globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
		await fireEvent.press(screen.getByText('Test'));
		expect(await screen.findByText('API unreachable')).toBeOnTheScreen();
	});

	it('saves a valid address without the trailing slash', async () => {
		await render(<SettingsScreen />);
		await fireEvent.changeText(
			screen.getByLabelText('Backend address'),
			' http://10.0.0.5:3000/ ',
		);
		await fireEvent.press(screen.getByText('Save'));

		expect(useSettings.getState().apiUrl).toBe('http://10.0.0.5:3000');
		expect(screen.getByText('Saved')).toBeOnTheScreen();
	});

	it('refuses an invalid address', async () => {
		await render(<SettingsScreen />);
		await fireEvent.changeText(screen.getByLabelText('Backend address'), 'localhost:3000');

		expect(screen.getByText('Enter an http:// or https:// address')).toBeOnTheScreen();
		await fireEvent.press(screen.getByText('Save'));
		expect(useSettings.getState().apiUrl).toBe(DEFAULT_API_URL);
	});

	it('resets to the default address', async () => {
		useSettings.getState().setApiUrl('http://10.0.0.5:3000');
		await render(<SettingsScreen />);
		await fireEvent.press(screen.getByText('Reset'));

		expect(useSettings.getState().apiUrl).toBe(DEFAULT_API_URL);
		expect(screen.getByLabelText('Backend address').props.value).toBe(DEFAULT_API_URL);
	});
});
