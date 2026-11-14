import { describe, expect, it } from 'vitest';
import { AddEntryBody, CreatePlaylistBody, MoveEntryBody } from '../src/index.js';

describe('playlist schemas', () => {
	it('defaults to public and editable by everyone', () => {
		expect(CreatePlaylistBody.parse({ name: 'Road trip' })).toEqual({
			name: 'Road trip',
			visibility: 'PUBLIC',
			editLicense: 'EVERYONE',
		});
	});

	it('names entries by id, never by index', () => {
		expect(MoveEntryBody.safeParse({ afterEntryId: 3 }).success).toBe(false);
		expect(MoveEntryBody.safeParse({ afterEntryId: null }).success).toBe(true);
		expect(AddEntryBody.parse({ deezerId: '42' })).toEqual({ deezerId: 42 });
	});
});
