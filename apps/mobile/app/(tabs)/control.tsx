import { useQuery } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { deviceKeys, getControllable } from '@/api/devices';
import { ListRow } from '@/components/list-row';
import { QueryStatus } from '@/components/query-status';
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
			<QueryStatus
				query={devices}
				isEmpty={devices.data?.length === 0}
				emptyText="Nothing to control yet"
			/>
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
