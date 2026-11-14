import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Link, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { queryClient } from '@/api/query-client';
import { ThemedText } from '@/components/themed-text';
import { startSocket } from '@/realtime/socket';
import { useSession } from '@/stores/session';

const settingsLink = () => (
	<Link href="/settings">
		<ThemedText type="linkPrimary">Settings</ThemedText>
	</Link>
);

export default function RootLayout() {
	const colorScheme = useColorScheme();
	const status = useSession((s) => s.status);

	useEffect(() => {
		useSession.getState().restore();
		startSocket();
	}, []);

	if (status === 'loading') return null;
	const signedIn = status === 'signedIn';

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
				<Stack screenOptions={{ headerRight: settingsLink }}>
					{/* Explicit targets: the default picks the first free route by file name. */}
					<Stack.Protected guard={signedIn} redirectTo="/welcome">
						<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
						<Stack.Screen name="user/[id]" options={{ title: 'Profile' }} />
						<Stack.Screen name="event/new" options={{ title: 'New event' }} />
						<Stack.Screen name="event/[id]/index" options={{ title: 'Event' }} />
						<Stack.Screen name="event/[id]/edit" options={{ title: 'Edit event' }} />
						<Stack.Screen
							name="event/[id]/suggest"
							options={{ title: 'Suggest a track' }}
						/>
						<Stack.Screen name="event/[id]/invite" options={{ title: 'Invite' }} />
						<Stack.Screen
							name="change-password"
							options={{ title: 'Change password' }}
						/>
						<Stack.Screen
							name="linked-accounts"
							options={{ title: 'Linked accounts' }}
						/>
					</Stack.Protected>
					<Stack.Protected guard={!signedIn} redirectTo="/">
						<Stack.Screen name="welcome" options={{ title: 'Welcome' }} />
						<Stack.Screen name="log-in" options={{ title: 'Log in' }} />
						<Stack.Screen name="sign-up" options={{ title: 'Create an account' }} />
						<Stack.Screen name="check-inbox" options={{ title: 'Check your inbox' }} />
						<Stack.Screen
							name="forgot-password"
							options={{ title: 'Forgot password' }}
						/>
						<Stack.Screen name="account-exists" options={{ title: 'Account exists' }} />
					</Stack.Protected>
					<Stack.Screen
						name="settings"
						options={{ title: 'Settings', headerRight: undefined }}
					/>
					<Stack.Screen name="verify" options={{ title: 'Confirm email' }} />
					<Stack.Screen name="reset" options={{ title: 'New password' }} />
				</Stack>
			</ThemeProvider>
		</QueryClientProvider>
	);
}
