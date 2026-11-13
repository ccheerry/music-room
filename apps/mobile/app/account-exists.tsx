import { router, useLocalSearchParams } from 'expo-router';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';

const NAMES: Record<string, string> = { google: 'Google', facebook: 'Facebook' };

export default function AccountExistsScreen() {
	const { provider } = useLocalSearchParams<{ provider?: string }>();
	const name = NAMES[provider ?? ''] ?? 'this provider';

	return (
		<Screen>
			<ThemedText type="subtitle">You already have an account</ThemedText>
			<ThemedText themeColor="textSecondary">
				An account with the same email already exists. For your security we do not merge
				accounts automatically. Log in with your email and password, then open Linked
				accounts and link {name}. After that, both ways log into the same account.
			</ThemedText>
			<Button label="Log in" onPress={() => router.replace('/log-in')} />
		</Screen>
	);
}
