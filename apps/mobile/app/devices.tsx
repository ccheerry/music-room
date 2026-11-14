import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { deviceKeys, getMyDevices } from '@/api/devices';
import { errorMessage } from '@/api/errors';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function DevicesScreen() {
	const devices = useQuery({ queryKey: deviceKeys.mine, queryFn: getMyDevices });
	return (
		<Screen>
			<ThemedText themeColor="textSecondary">
				Choose which friends may control the music on each of your devices.
			</ThemedText>
			{devices.isError && (
				<ThemedText themeColor="danger">{errorMessage(devices.error)}</ThemedText>
			)}
			{devices.data?.map((d) => (
				<ListRow
					key={d.id}
					title={`${d.name}${d.current ? ' (this device)' : ''}`}
					subtitle={`${d.platform} · ${d.online ? 'online' : 'offline'} · ${d.grants.length} friend${d.grants.length === 1 ? '' : 's'} can control`}
					onPress={() => router.push({ pathname: '/device/[id]', params: { id: d.id } })}
				/>
			))}
		</Screen>
	);
}
