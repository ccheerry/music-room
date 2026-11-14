import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { deviceKeys, getMyDevices, removeDevice, renameDevice, setGrant } from '@/api/devices';
import { errorMessage } from '@/api/errors';
import { getFriends } from '@/api/users';
import { Button } from '@/components/button';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { Input } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';

// Empty or zero: no time limit.
function expiryIn(hours: string): string | null {
	const h = Number(hours);
	return h > 0 ? new Date(Date.now() + h * 3600 * 1000).toISOString() : null;
}

export default function DeviceScreen() {
	const { id } = useLocalSearchParams<{ id: string }>();
	const devices = useQuery({ queryKey: deviceKeys.mine, queryFn: getMyDevices });
	const friends = useQuery({ queryKey: ['friends', 'list'], queryFn: getFriends });
	const device = devices.data?.find((d) => d.id === id);
	const [name, setName] = useState<string | null>(null);
	const [hours, setHours] = useState('');
	const [error, setError] = useState<string | null>(null);
	const run = (action: () => Promise<unknown>) => {
		setError(null);
		action().catch((err) => setError(errorMessage(err)));
	};

	if (!device) return <Screen>{null}</Screen>;
	const grants = new Map(device.grants.map((g) => [g.user.id, g]));

	return (
		<Screen>
			<ThemedText type="smallBold">Name</ThemedText>
			<Input
				accessibilityLabel="Device name"
				value={name ?? device.name}
				onChangeText={setName}
			/>
			<Button
				label="Rename"
				variant="secondary"
				disabled={!name?.trim()}
				onPress={() => run(() => renameDevice(id, name!.trim()))}
			/>

			<ThemedText type="smallBold">Friends who can control it</ThemedText>
			<Input
				accessibilityLabel="Grant for hours"
				placeholder="For how many hours (empty: no limit)"
				value={hours}
				onChangeText={setHours}
				inputMode="decimal"
			/>
			{friends.data?.length === 0 && (
				<ThemedText themeColor="textSecondary">Add friends first</ThemedText>
			)}
			{friends.data?.map((f) => {
				const g = grants.get(f.id);
				return (
					<ListRow
						key={f.id}
						title={f.displayName}
						subtitle={
							g
								? g.expiresAt
									? `until ${new Date(g.expiresAt).toLocaleString()}`
									: 'no time limit'
								: undefined
						}
					>
						<Button
							label={g ? 'Revoke' : 'Allow'}
							variant={g ? 'secondary' : 'primary'}
							onPress={() => run(() => setGrant(id, f.id, !g, expiryIn(hours)))}
						/>
					</ListRow>
				);
			})}
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
			{!device.current && (
				<Button
					label="Remove this device"
					variant="secondary"
					onPress={() =>
						run(async () => {
							await removeDevice(id);
							router.back();
						})
					}
				/>
			)}
		</Screen>
	);
}
