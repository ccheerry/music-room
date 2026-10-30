import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Link, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { queryClient } from '@/api/query-client';
import { ThemedText } from '@/components/themed-text';
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
	}, []);

	if (status === 'loading') return null;
	const signedIn = status === 'signedIn';

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
				<Stack screenOptions={{ headerRight: settingsLink }}>
					{/* Explicit targets: the default picks the first free route by file name. */}
					<Stack.Protected guard={signedIn} redirectTo="/welcome">
						<Stack.Screen name="index" options={{ title: 'Music Room' }} />
						<Stack.Screen
							name="change-password"
							options={{ title: 'Change password' }}
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
