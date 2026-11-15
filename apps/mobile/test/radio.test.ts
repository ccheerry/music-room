import type { Track } from '@music-room/shared';

import { loadFresh } from '@/features/player/player';
import { playInOrder } from '@/features/playlists/radio';

jest.mock('@/features/player/player', () => ({ loadFresh: jest.fn() }));
const mockLoad = loadFresh as jest.MockedFunction<typeof loadFresh>;

const track = (id: number, preview = true): Track => ({
	id,
	title: `T${id}`,
	artist: 'A',
	album: 'B',
	coverUrl: null,
	previewUrl: preview ? `https://cdn.test/${id}.mp3` : null,
	durationSec: 30,
});
const TRACKS = [track(1), track(2, false), track(3)];
const loaded = () => mockLoad.mock.calls.map(([t]) => t.id);

beforeEach(() => mockLoad.mockClear());

describe('playInOrder', () => {
	it('starts at the chosen track and names its source', () => {
		playInOrder(TRACKS, 0, 'playlist:1');
		expect(loaded()).toEqual([1]);
		expect(mockLoad.mock.calls[0]![1]).toMatchObject({ source: 'playlist:1' });
	});

	it('skips tracks without preview, on start and when a track ends', () => {
		playInOrder(TRACKS, 1, 'p');
		expect(loaded()).toEqual([3]);
		mockLoad.mockClear();
		playInOrder(TRACKS, 0, 'p');
		mockLoad.mock.calls[0]![1]!.onEnd!();
		expect(loaded()).toEqual([1, 3]);
	});

	it('next and previous move along the list and stop at its ends', () => {
		playInOrder(TRACKS, 2, 'p');
		const { controls } = mockLoad.mock.calls[0]![1]!;
		controls!.next!();
		expect(loaded()).toEqual([3]);
		// Previous steps over the track without preview.
		controls!.prev!();
		expect(loaded()).toEqual([3, 1]);
	});

	it('does nothing when no track can be played', () => {
		playInOrder([track(1, false)], 0, 'p');
		expect(mockLoad).not.toHaveBeenCalled();
	});
});
