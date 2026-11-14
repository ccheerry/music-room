import type { RelayedCommand, Track } from '@music-room/shared';

import { currentStatus, handleCommand } from '@/features/devices/command-handler';
import { usePlayer } from '@/features/player/player';

const deviceId = '00000000-0000-4000-8000-0000000000d1';
const from = '00000000-0000-4000-8000-0000000000f1';
const track: Track = {
	id: 7,
	title: 'Seven',
	artist: 'A',
	album: 'B',
	coverUrl: null,
	previewUrl: 'https://cdn.test/7.mp3',
	durationSec: 30,
};
const cmd = (
	action: RelayedCommand['action'],
	extra: Partial<RelayedCommand> = {},
): RelayedCommand => ({
	deviceId,
	action,
	from,
	...extra,
});

describe('handleCommand', () => {
	const next = jest.fn();
	const prev = jest.fn();

	beforeEach(() => {
		jest.clearAllMocks();
		usePlayer.getState().load(track, { autoplay: false, controls: { next, prev } });
	});

	it('maps play, pause and volume to the player', () => {
		const play = jest.spyOn(usePlayer.getState(), 'play');
		const pause = jest.spyOn(usePlayer.getState(), 'pause');
		expect(handleCommand(cmd('play'))).toBe(true);
		expect(handleCommand(cmd('pause'))).toBe(true);
		expect(handleCommand(cmd('volume', { value: 0.3 }))).toBe(true);
		expect(play).toHaveBeenCalled();
		expect(pause).toHaveBeenCalled();
		expect(usePlayer.getState().volume).toBe(0.3);
	});

	it('runs next / prev of the current source', () => {
		expect(handleCommand(cmd('next', { trackId: 7 }))).toBe(true);
		expect(handleCommand(cmd('prev', { trackId: 7 }))).toBe(true);
		expect(next).toHaveBeenCalledTimes(1);
		expect(prev).toHaveBeenCalledTimes(1);
	});

	it('ignores a next sent for a track that is no longer playing', () => {
		expect(handleCommand(cmd('next', { trackId: 99 }))).toBe(false);
		expect(next).not.toHaveBeenCalled();
	});

	it('cannot skip when the source has no list', () => {
		usePlayer.getState().load(track, { autoplay: false });
		expect(handleCommand(cmd('next', { trackId: 7 }))).toBe(false);
	});

	it('reports the player status', () => {
		expect(currentStatus(deviceId)).toMatchObject({ deviceId, track, playing: false });
	});
});
