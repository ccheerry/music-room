import { describe, expect, it } from 'vitest';
import { ClientHeaders } from '../src/index.js';

describe('ClientHeaders', () => {
	it('reads the app headers and ignores the rest', () => {
		const headers = {
			'x-platform': 'ios',
			'x-device': 'iPhone 15',
			'x-app-version': '1.0.0',
			host: 'localhost',
		};
		expect(ClientHeaders.parse(headers)).toEqual({
			'x-platform': 'ios',
			'x-device': 'iPhone 15',
			'x-app-version': '1.0.0',
		});
	});

	it('falls back to unknown for missing or invalid values', () => {
		expect(
			ClientHeaders.parse({ 'x-platform': 'toaster', 'x-device': 'x'.repeat(500) }),
		).toEqual({
			'x-platform': 'unknown',
			'x-device': 'unknown',
			'x-app-version': 'unknown',
		});
	});
});
