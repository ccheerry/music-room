import type { Track } from '@music-room/shared';
import { act, renderHook } from '@testing-library/react-native';

import { getTrack } from '@/api/catalog';
import { loadFresh, usePlayer } from '@/features/player/player';
import { useDebounced } from '@/hooks/use-debounced';

type Listener = (status: object) => void;
const mockAudio = {
	listener: null as Listener | null,
	replace: jest.fn(),
	play: jest.fn(),
	pause: jest.fn(),
	seekTo: jest.fn(async () => undefined),
	volume: 1,
	addListener: jest.fn((_event: string, fn: Listener) => {
		mockAudio.listener = fn;
	}),
};

jest.mock('expo-audio', () => ({ createAudioPlayer: () => mockAudio }));
jest.mock('@/api/catalog', () => ({ getTrack: jest.fn() }));
const mockGetTrack = getTrack as jest.MockedFunction<typeof getTrack>;

const TRACK: Track = {
	id: 1,
	title: 'One More Time',
	artist: 'Daft Punk',
	album: 'Discovery',
	coverUrl: null,
	previewUrl: 'https://cdn.test/1.mp3',
	durationSec: 320,
};

const status = (extra: object) =>
	mockAudio.listener?.({
		playing: true,
		currentTime: 0,
		duration: 30,
		didJustFinish: false,
		...extra,
	});

beforeEach(() => {
	jest.clearAllMocks();
	usePlayer.getState().stop();
});

describe('player store', () => {
	it('loads a preview at an offset and plays it', () => {
		usePlayer.getState().load(TRACK, { startMs: 5000, source: 'event:1' });
		expect(mockAudio.replace).toHaveBeenCalledWith({ uri: TRACK.previewUrl });
		expect(mockAudio.seekTo).toHaveBeenCalledWith(5);
		expect(mockAudio.play).toHaveBeenCalled();
		expect(usePlayer.getState()).toMatchObject({ track: TRACK, source: 'event:1' });
	});

	it('mirrors the native status and calls onEnd once finished', () => {
		const onEnd = jest.fn();
		usePlayer.getState().load(TRACK, { onEnd });
		status({ currentTime: 12.5 });
		expect(usePlayer.getState()).toMatchObject({
			playing: true,
			positionMs: 12500,
			durationMs: 30000,
		});
		status({ playing: false, didJustFinish: true });
		expect(onEnd).toHaveBeenCalledTimes(1);
	});

	it('keeps a track without preview silent', () => {
		usePlayer.getState().load({ ...TRACK, previewUrl: null });
		expect(mockAudio.replace).not.toHaveBeenCalled();
		usePlayer.getState().play();
		expect(mockAudio.play).not.toHaveBeenCalled();
	});

	it('clamps the volume', () => {
		usePlayer.getState().load(TRACK);
		usePlayer.getState().setVolume(1.7);
		expect(mockAudio.volume).toBe(1);
		usePlayer.getState().setVolume(-1);
		expect(usePlayer.getState().volume).toBe(0);
	});

	it('stop forgets the track and its onEnd', () => {
		const onEnd = jest.fn();
		usePlayer.getState().load(TRACK, { onEnd });
		usePlayer.getState().stop();
		status({ didJustFinish: true });
		expect(onEnd).not.toHaveBeenCalled();
		expect(usePlayer.getState().track).toBeNull();
	});
});

describe('useDebounced', () => {
	afterEach(() => jest.useRealTimers());

	it('only updates once the value stops changing', async () => {
		const { result, rerender } = await renderHook(
			({ v }: { v: string }) => useDebounced(v, 300),
			{
				initialProps: { v: 'd' },
			},
		);
		jest.useFakeTimers();
		await rerender({ v: 'da' });
		await act(() => jest.advanceTimersByTime(200));
		await rerender({ v: 'daft' });
		await act(() => jest.advanceTimersByTime(200));
		expect(result.current).toBe('d');
		await act(() => jest.advanceTimersByTime(100));
		expect(result.current).toBe('daft');
	});
});

describe('loadFresh', () => {
	const fresh = { ...TRACK, previewUrl: 'https://cdn.test/1-fresh.mp3' };

	it('plays the preview link the server gives now, not the stored one', async () => {
		mockGetTrack.mockResolvedValue(fresh);
		await loadFresh(TRACK, { source: 'playlist:1' });
		expect(mockGetTrack).toHaveBeenCalledWith(TRACK.id);
		expect(mockAudio.replace).toHaveBeenCalledWith({ uri: fresh.previewUrl });
		expect(usePlayer.getState().source).toBe('playlist:1');
	});

	it('falls back to the stored track when the server cannot be reached', async () => {
		mockGetTrack.mockRejectedValue(new Error('offline'));
		await loadFresh(TRACK);
		expect(mockAudio.replace).toHaveBeenCalledWith({ uri: TRACK.previewUrl });
	});

	it('only the last request plays', async () => {
		const other = { ...TRACK, id: 2, previewUrl: 'https://cdn.test/2.mp3' };
		let answerFirst: (t: Track) => void = () => undefined;
		mockGetTrack
			.mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
			.mockResolvedValueOnce(other);
		const first = loadFresh(TRACK);
		await loadFresh(other);
		answerFirst(fresh);
		await first;
		expect(mockAudio.replace).toHaveBeenCalledTimes(1);
		expect(usePlayer.getState().track).toEqual(other);
	});

	it('is dropped when the player was stopped meanwhile', async () => {
		let answer: (t: Track) => void = () => undefined;
		mockGetTrack.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)));
		const pending = loadFresh(TRACK);
		usePlayer.getState().stop();
		answer(fresh);
		await pending;
		expect(mockAudio.replace).not.toHaveBeenCalled();
	});
});
