import { router } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

export default function WelcomeScreen() {
	return (
		<Screen>
			<ThemedText type="subtitle">Music Room</ThemedText>
			<ThemedText themeColor="textSecondary">
				Vote for the next track, edit playlists together and share control of your music.
			</ThemedText>
			<Button label="Log in" onPress={() => router.push('/log-in')} />
			<Button
				label="Create an account"
				variant="secondary"
				onPress={() => router.push('/sign-up')}
			/>
		</Screen>
	);
}
