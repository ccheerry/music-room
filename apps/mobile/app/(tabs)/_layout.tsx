import { Link, Tabs } from 'expo-router';

import { ThemedText } from '@/components/themed-text';

const settingsLink = () => (
	<Link href="/settings" style={{ marginRight: 16 }}>
		<ThemedText type="linkPrimary">Settings</ThemedText>
	</Link>
);

// Text-only tabs: the label is the target.
export default function TabsLayout() {
	return (
		<Tabs
			screenOptions={{
				headerRight: settingsLink,
				tabBarIconStyle: { display: 'none' },
				tabBarLabelStyle: { fontSize: 14, fontWeight: '600' },
				tabBarLabelPosition: 'beside-icon',
			}}
		>
			<Tabs.Screen name="index" options={{ title: 'Home' }} />
			<Tabs.Screen name="friends" options={{ title: 'Friends' }} />
			<Tabs.Screen name="profile" options={{ title: 'Profile' }} />
		</Tabs>
	);
}
