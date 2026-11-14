import type { Track } from '@music-room/shared';

import { usePlayer } from '@/features/player/player';

// Plays the tracks in order from `index`, skipping those without preview.
export function playInOrder(tracks: Track[], index: number, source: string): void {
	const at = tracks.findIndex((t, i) => i >= index && t.previewUrl);
	if (at === -1) return;
	usePlayer.getState().load(tracks[at]!, {
		source,
		onEnd: () => playInOrder(tracks, at + 1, source),
		controls: {
			next: () => playInOrder(tracks, at + 1, source),
			prev: () => playInOrder(tracks, Math.max(0, at - 1), source),
		},
	});
}
