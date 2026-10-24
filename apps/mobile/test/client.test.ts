import { apiFetch } from '@/api/client';
import { useSettings } from '@/stores/settings';

describe('apiFetch', () => {
	it('prefixes the stored address and adds the device headers', async () => {
		const fetchMock = jest.fn().mockResolvedValue({ status: 204 });
		globalThis.fetch = fetchMock;
		useSettings.getState().setApiUrl('http://10.0.0.5:3000');

		await apiFetch('/me', { headers: { Authorization: 'Bearer t' } });

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe('http://10.0.0.5:3000/api/v1/me');
		expect(init.headers).toEqual({
			'X-Platform': expect.any(String),
			'X-Device': expect.any(String),
			'X-App-Version': expect.any(String),
			Authorization: 'Bearer t',
		});
	});
});
