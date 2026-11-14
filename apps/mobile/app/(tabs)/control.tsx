import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { deviceKeys, getControllable } from '@/api/devices';
import { errorMessage } from '@/api/errors';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function ControlScreen() {
	const devices = useQuery({ queryKey: deviceKeys.controllable, queryFn: getControllable });
	const { refetch } = devices;
	// Online state changes all the time: refresh when the tab is opened.
	useFocusEffect(
		useCallback(() => {
			void refetch();
		}, [refetch]),
	);

	return (
		<Screen>
			<ThemedText themeColor="textSecondary">
				Devices you can control: yours and those your friends shared with you.
			</ThemedText>
			{devices.isError && (
				<ThemedText themeColor="danger">{errorMessage(devices.error)}</ThemedText>
			)}
			{devices.data?.length === 0 && (
				<ThemedText themeColor="textSecondary">Nothing to control yet</ThemedText>
			)}
			{devices.data?.map((d) => (
				<ListRow
					key={d.id}
					title={d.name}
					subtitle={`${d.owner.displayName} · ${d.online ? 'online' : 'offline'}${d.expiresAt ? ` · until ${new Date(d.expiresAt).toLocaleString()}` : ''}`}
					onPress={() =>
						router.push({
							pathname: '/remote/[id]',
							params: { id: d.id, name: d.name },
						})
					}
				/>
			))}
		</Screen>
	);
}
