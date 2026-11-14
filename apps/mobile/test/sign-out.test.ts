import { ApiError, errorMessage } from '@/api/errors';
import { queryClient } from '@/api/query-client';
import { usePlayer } from '@/features/player/player';
import { useSession } from '@/stores/session';
import { wipeOnSignOut } from '@/stores/wipe-on-sign-out';

jest.mock('expo-audio', () => ({
	createAudioPlayer: () => ({
		addListener: jest.fn(),
		replace: jest.fn(),
		play: jest.fn(),
		pause: jest.fn(),
		seekTo: jest.fn(async () => undefined),
		volume: 1,
	}),
}));

describe('wipeOnSignOut', () => {
	it('empties the caches and stops the music when the session ends', async () => {
		const stop = wipeOnSignOut();
		await useSession.getState().signIn({ accessToken: 'a', refreshToken: 'r', expiresIn: 900 });
		queryClient.setQueryData(['me'], { email: 'ana@test.local' });
		usePlayer.getState().load({
			id: 1,
			title: 'T',
			artist: 'A',
			album: 'B',
			coverUrl: null,
			previewUrl: 'https://cdn.test/1.mp3',
			durationSec: 30,
		});

		await useSession.getState().signOut();
		expect(queryClient.getQueryData(['me'])).toBeUndefined();
		expect(usePlayer.getState().track).toBeNull();
		stop();
	});
});

describe('errorMessage', () => {
	it('keeps the delay the server gives on a 429', () => {
		const err = new ApiError(429, 'RATE_LIMITED', 'Too many requests, retry in 1 minute');
		expect(errorMessage(err)).toBe('Too many attempts, retry in 1 minute');
	});

	it('explains an ended session, a refusal and an unreachable server', () => {
		expect(errorMessage(new ApiError(401, 'UNAUTHORIZED', 'x'))).toMatch(/log in again/);
		expect(errorMessage(new ApiError(403, 'FORBIDDEN', 'x'))).toMatch(/not allowed/);
		expect(errorMessage(new TypeError('Network request failed'))).toMatch(/reach the server/);
	});
});
