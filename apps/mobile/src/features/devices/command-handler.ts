import type { DeviceStatus, RelayedCommand } from '@music-room/shared';

import { usePlayer } from '@/features/player/player';

const VOLUME_STEP = 0.1;
export { VOLUME_STEP };

// Applies a remote command to the local player. next / prev name the track the
// controller saw: one meant for another track is stale and ignored.
export function handleCommand(cmd: RelayedCommand): boolean {
	const player = usePlayer.getState();
	const playingId = player.track?.id ?? null;
	switch (cmd.action) {
		case 'play':
			player.play();
			return true;
		case 'pause':
			player.pause();
			return true;
		case 'volume':
			player.setVolume(cmd.value ?? player.volume);
			return true;
		case 'next':
		case 'prev': {
			if (cmd.trackId != null && cmd.trackId !== playingId) return false;
			const move = player.controls[cmd.action];
			if (!move) return false;
			move();
			return true;
		}
	}
}

export function currentStatus(deviceId: string): DeviceStatus {
	const { track, playing, positionMs, volume } = usePlayer.getState();
	return { deviceId, track, playing, positionMs: Math.max(0, positionMs), volume };
}
