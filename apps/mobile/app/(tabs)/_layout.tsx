import { Link, Tabs } from 'expo-router';
import { BottomTabBar } from 'expo-router/tabs';

import { ThemedText } from '@/components/themed-text';
import { useDeviceAgent } from '@/features/devices/use-device-agent';
import { MiniPlayer } from '@/features/player/mini-player';

const settingsLink = () => (
	<Link href="/settings" style={{ marginRight: 16 }}>
		<ThemedText type="linkPrimary">Settings</ThemedText>
	</Link>
);

// Text-only tabs: the label is the target.
export default function TabsLayout() {
	useDeviceAgent();
	return (
		<Tabs
			tabBar={(props) => (
				<>
					<MiniPlayer />
					<BottomTabBar {...props} />
				</>
			)}
			screenOptions={{
				headerRight: settingsLink,
				tabBarIconStyle: { display: 'none' },
				tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
				tabBarLabelPosition: 'beside-icon',
			}}
		>
			<Tabs.Screen name="index" options={{ title: 'Events' }} />
			<Tabs.Screen name="playlists" options={{ title: 'Playlists' }} />
			<Tabs.Screen name="search" options={{ title: 'Search' }} />
			<Tabs.Screen name="control" options={{ title: 'Control' }} />
			<Tabs.Screen name="profile" options={{ title: 'Profile' }} />
		</Tabs>
	);
}
