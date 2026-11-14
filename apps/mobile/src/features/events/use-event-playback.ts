import type { EventState } from '@music-room/shared';
import { useEffect } from 'react';

import { usePlayer } from '@/features/player/player';

// The owner's phone plays what the server says is playing, at the server's position.
export function useEventPlayback(eventId: string, state: EventState | undefined, isOwner: boolean) {
	const entryId = state?.current?.entryId ?? null;
	const current = state?.current ?? null;

	useEffect(() => {
		if (!isOwner) return;
		const source = `event:${eventId}`;
		const player = usePlayer.getState();
		if (!current) {
			if (player.source === source) player.stop();
			return;
		}
		const startMs = Math.max(0, Date.now() - Date.parse(current.startedAt));
		player.load(current.track, { startMs, source });
		// Only a new entry restarts the audio.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [eventId, entryId, isOwner]);
}
