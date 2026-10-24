import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Link, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';

const queryClient = new QueryClient();

export default function RootLayout() {
	const colorScheme = useColorScheme();
	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
				<Stack>
					<Stack.Screen
						name="index"
						options={{
							title: 'Music Room',
							headerRight: () => (
								<Link href="/settings">
									<ThemedText type="linkPrimary">Settings</ThemedText>
								</Link>
							),
						}}
					/>
					<Stack.Screen name="settings" options={{ title: 'Settings' }} />
				</Stack>
			</ThemeProvider>
		</QueryClientProvider>
	);
}
