import { describe, expect, it } from 'vitest';
import { RoomRef, roomName } from '../src/index.js';

describe('rooms', () => {
	const id = '0b7c6f1e-2f4a-4c1a-9d5e-3a1b2c3d4e5f';

	it('names rooms kind:id', () => {
		expect(roomName({ kind: 'event', id })).toBe(`event:${id}`);
	});

	it('only accepts known kinds and uuids', () => {
		expect(RoomRef.safeParse({ kind: 'playlist', id }).success).toBe(true);
		expect(RoomRef.safeParse({ kind: 'device', id }).success).toBe(false);
		expect(RoomRef.safeParse({ kind: 'event', id: 'x' }).success).toBe(false);
	});
});
