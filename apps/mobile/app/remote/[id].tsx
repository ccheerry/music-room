import type { Ack, DeviceAction, DeviceStatus } from '@music-room/shared';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { TrackRow } from '@/features/catalog/track-row';
import { VOLUME_STEP } from '@/features/devices/command-handler';
import { ConnectionBanner } from '@/realtime/connection-banner';
import { getSocket } from '@/realtime/socket';
import { useRoom } from '@/realtime/use-room';

export default function RemoteScreen() {
	const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
	const [status, setStatus] = useState<DeviceStatus | null>(null);
	const [error, setError] = useState<string | null>(null);

	useRoom({
		kind: 'remote',
		id,
		on: {
			'device:status': (s: DeviceStatus) => s.deviceId === id && setStatus(s),
			'device:revoked': (p: { deviceId: string }) => p.deviceId === id && router.back(),
		},
	});

	const send = (action: DeviceAction, value?: number) => {
		setError(null);
		const socket = getSocket();
		if (!socket) return setError('Not connected');
		socket.emit(
			'device:command',
			{ deviceId: id, action, trackId: status?.track?.id ?? null, value },
			(ack: Ack) => {
				if (!ack.ok) setError(ack.error.message);
			},
		);
	};

	const volume = status?.volume ?? 1;
	return (
		<Screen>
			<Stack.Screen options={{ title: name ?? 'Remote' }} />
			<ConnectionBanner />
			{status?.track ? (
				<TrackRow
					track={status.track}
					subtitle={`${status.track.artist} · ${status.playing ? 'playing' : 'paused'}`}
				/>
			) : (
				<ThemedText themeColor="textSecondary">
					{status
						? 'Nothing is playing on this device'
						: 'Waiting for the device… it must be online with the app open.'}
				</ThemedText>
			)}
			<View style={styles.row}>
				<Button label="Prev" variant="secondary" onPress={() => send('prev')} />
				<Button
					label={status?.playing ? 'Pause' : 'Play'}
					onPress={() => send(status?.playing ? 'pause' : 'play')}
				/>
				<Button label="Next" variant="secondary" onPress={() => send('next')} />
			</View>
			<View style={styles.row}>
				<Button
					label="Volume -"
					variant="secondary"
					onPress={() => send('volume', Math.max(0, volume - VOLUME_STEP))}
				/>
				<ThemedText>{Math.round(volume * 100)}%</ThemedText>
				<Button
					label="Volume +"
					variant="secondary"
					onPress={() => send('volume', Math.min(1, volume + VOLUME_STEP))}
				/>
			</View>
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { alignItems: 'center', flexDirection: 'row', gap: Spacing.two, justifyContent: 'center' },
});
