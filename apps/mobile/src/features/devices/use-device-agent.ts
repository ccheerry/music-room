import { DEVICE_STATUS_EVERY_MS, type RelayedCommand } from '@music-room/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';

import { deviceKeys, getMyDevices } from '@/api/devices';
import { currentStatus, handleCommand } from '@/features/devices/command-handler';
import { usePlayer } from '@/features/player/player';
import { getSocket, useSocketStatus } from '@/realtime/socket';

// This phone as a controllable device: obeys relayed commands, reports what it plays.
export function useDeviceAgent() {
	const status = useSocketStatus((s) => s.status);
	const devices = useQuery({ queryKey: deviceKeys.mine, queryFn: getMyDevices });
	const deviceId = devices.data?.find((d) => d.current)?.id;

	useEffect(() => {
		const socket = getSocket();
		if (!socket || status !== 'online' || !deviceId) return;
		const report = () => socket.emit('device:status', currentStatus(deviceId), () => undefined);
		const onCommand = (cmd: RelayedCommand) => {
			if (cmd.deviceId === deviceId && handleCommand(cmd)) setTimeout(report, 300);
		};
		socket.on('device:command', onCommand);

		// On every track / play state change, and periodically: a controller that
		// opens the remote later must see the device, even when it is idle.
		let last = '';
		const unsubscribe = usePlayer.subscribe((s) => {
			const key = `${s.track?.id}|${s.playing}|${s.volume}`;
			if (key !== last) {
				last = key;
				report();
			}
		});
		const timer = setInterval(report, DEVICE_STATUS_EVERY_MS);
		report();
		return () => {
			socket.off('device:command', onCommand);
			unsubscribe();
			clearInterval(timer);
		};
	}, [status, deviceId]);
}
