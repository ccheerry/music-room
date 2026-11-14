import { describe, expect, it } from 'vitest';
import { CreateEventBody, UpdateEventBody } from '../src/index.js';

const zone = {
	lat: 40.4,
	lng: -3.7,
	radiusM: 200,
	startsAt: '2026-11-13T20:00:00.000Z',
	endsAt: '2026-11-14T02:00:00.000Z',
};

describe('event schemas', () => {
	it('defaults to a public event anyone can vote in', () => {
		expect(CreateEventBody.parse({ name: 'Party' })).toEqual({
			name: 'Party',
			visibility: 'PUBLIC',
			voteLicense: 'EVERYONE',
		});
	});

	it('needs a zone for a LOCATION license', () => {
		expect(CreateEventBody.safeParse({ name: 'P', voteLicense: 'LOCATION' }).success).toBe(
			false,
		);
		expect(
			CreateEventBody.safeParse({ name: 'P', voteLicense: 'LOCATION', zone }).success,
		).toBe(true);
	});

	it('rejects a window that ends before it starts', () => {
		const bad = { ...zone, endsAt: zone.startsAt, startsAt: zone.endsAt };
		expect(UpdateEventBody.safeParse({ zone: bad }).success).toBe(false);
	});
});
