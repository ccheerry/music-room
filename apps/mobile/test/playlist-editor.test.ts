import type { PlaylistEntry, PlaylistState, Track } from '@music-room/shared';

import { playlistKeys, editPlaylist } from '@/api/playlists';
import { queryClient } from '@/api/query-client';
import { afterForDown, afterForDrop, afterForUp, applyOp } from '@/features/playlists/apply-op';
import { useSession } from '@/stores/session';
import { reply } from './fixtures';

const by = { id: '00000000-0000-4000-8000-000000000001', displayName: 'Ana' };
const track = (id: number): Track => ({
	id,
	title: `T${id}`,
	artist: 'A',
	album: 'B',
	coverUrl: null,
	previewUrl: null,
	durationSec: 1,
});
const entry = (id: string, n: number): PlaylistEntry => ({
	id,
	track: track(n),
	position: `a${n}`,
	addedBy: by,
});
const [A, B, C] = [
	'00000000-0000-4000-8000-00000000000a',
	'00000000-0000-4000-8000-00000000000b',
	'00000000-0000-4000-8000-00000000000c',
];
const STATE: PlaylistState = {
	playlistId: '00000000-0000-4000-8000-0000000000aa',
	version: 3,
	entries: [entry(A, 1), entry(B, 2), entry(C, 3)],
};
const ids = (s: PlaylistState | undefined) => s?.entries.map((e) => e.id);

describe('applyOp', () => {
	it('moves by id, to the top or after an entry', () => {
		expect(ids(applyOp(STATE, { kind: 'move', entryId: C, afterEntryId: null }))).toEqual([
			C,
			A,
			B,
		]);
		expect(ids(applyOp(STATE, { kind: 'move', entryId: A, afterEntryId: B }))).toEqual([
			B,
			A,
			C,
		]);
	});

	it('adds a pending entry at the end by default and removes by id', () => {
		const added = applyOp(STATE, { kind: 'add', track: track(9), by });
		expect(added.entries.at(-1)?.id).toMatch(/^pending-/);
		expect(ids(applyOp(STATE, { kind: 'remove', entryId: B }))).toEqual([A, C]);
	});

	it('keeps the version so the server answer always wins', () => {
		expect(applyOp(STATE, { kind: 'remove', entryId: A }).version).toBe(3);
	});

	it('ignores a move of an entry that is gone', () => {
		expect(applyOp(STATE, { kind: 'move', entryId: 'zz', afterEntryId: null })).toBe(STATE);
	});

	it('computes up / down targets', () => {
		expect(afterForUp(STATE.entries, 1)).toBeNull();
		expect(afterForUp(STATE.entries, 2)).toBe(A);
		expect(afterForDown(STATE.entries, 0)).toBe(B);
		expect(afterForDown(STATE.entries, 2)).toBeUndefined();
	});

	it('computes the drop target of a drag', () => {
		// [A, B, C]
		expect(afterForDrop(STATE.entries, 2, 0)).toBeNull();
		expect(afterForDrop(STATE.entries, 0, 2)).toBe(C);
		expect(afterForDrop(STATE.entries, 0, 1)).toBe(B);
		expect(afterForDrop(STATE.entries, 2, 1)).toBe(A);
		expect(afterForDrop(STATE.entries, 1, 1)).toBeUndefined();
	});

	it('never anchors a drop on an entry that is still pending', () => {
		const withPending = [entry(A, 1), entry('pending-1', 9), entry(B, 2)];
		// B dropped right below the pending entry lands after A.
		expect(afterForDrop(withPending, 2, 2)).toBeUndefined();
		expect(afterForDrop([...withPending, entry(C, 3)], 3, 2)).toBe(A);
		expect(afterForDrop([entry('pending-1', 9), entry(B, 2)], 1, 1)).toBeUndefined();
		expect(afterForDrop([entry('pending-1', 9), entry(B, 2), entry(C, 3)], 2, 1)).toBeNull();
	});
});

describe('editPlaylist', () => {
	const key = playlistKeys.entries(STATE.playlistId);

	beforeEach(async () => {
		queryClient.clear();
		queryClient.setQueryData(key, STATE);
		await useSession.getState().signIn({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
	});

	it('shows the change at once, then reconciles with the server state', async () => {
		const server = {
			...STATE,
			version: 4,
			entries: [entry(C, 3), entry(A, 1), entry(B, 2)],
		};
		let resolve: (v: unknown) => void = () => undefined;
		globalThis.fetch = jest.fn(() => new Promise((r) => (resolve = r))) as never;

		const pending = editPlaylist(STATE.playlistId, {
			kind: 'move',
			entryId: C,
			afterEntryId: null,
		});
		await new Promise((r) => setTimeout(r, 0));
		expect(ids(queryClient.getQueryData(key))).toEqual([C, A, B]);
		resolve(reply(200, server));
		expect(await pending).toBe('ok');
		expect(queryClient.getQueryData<PlaylistState>(key)?.version).toBe(4);
	});

	it('rolls back when the request fails', async () => {
		globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
		await expect(
			editPlaylist(STATE.playlistId, { kind: 'remove', entryId: A }),
		).rejects.toThrow();
		expect(ids(queryClient.getQueryData(key))).toEqual([A, B, C]);
	});

	it('replaces the cache with the state sent on 409 STALE', async () => {
		const current = { ...STATE, version: 7, entries: [entry(B, 2)] };
		globalThis.fetch = jest
			.fn()
			.mockResolvedValue(
				reply(409, { error: { code: 'STALE', message: 'x' }, state: current }),
			);
		expect(await editPlaylist(STATE.playlistId, { kind: 'remove', entryId: A })).toBe('stale');
		expect(queryClient.getQueryData(key)).toEqual(current);
	});
});
