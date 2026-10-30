import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { checkHealth, type HealthStatus } from '@/api/client';
import { Button } from '@/components/button';
import { HealthBadge } from '@/components/health-badge';
import { Screen } from '@/components/screen';
import { Input } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { DEFAULT_API_URL, useSettings } from '@/stores/settings';

const URL_PATTERN = /^https?:\/\/[^\s/]+(\/\S*)?$/i;

const normalize = (url: string) => url.trim().replace(/\/+$/, '');

export default function SettingsScreen() {
	const { apiUrl, setApiUrl, resetApiUrl } = useSettings();
	const [draft, setDraft] = useState(apiUrl);
	const [health, setHealth] = useState<HealthStatus | 'checking' | null>(null);
	const [message, setMessage] = useState<string | null>(null);

	const url = normalize(draft);
	const valid = URL_PATTERN.test(url);

	const test = async () => {
		setHealth('checking');
		setHealth(await checkHealth(url));
	};

	const save = () => {
		setApiUrl(url);
		setDraft(url);
		setMessage('Saved');
	};

	const reset = () => {
		resetApiUrl();
		setDraft(DEFAULT_API_URL);
		setHealth(null);
		setMessage('Back to the default address');
	};

	return (
		<Screen>
			<ThemedText type="smallBold">Backend address</ThemedText>
			<Input
				accessibilityLabel="Backend address"
				inputMode="url"
				onChangeText={(text) => {
					setDraft(text);
					setHealth(null);
					setMessage(null);
				}}
				placeholder="http://192.168.1.10:3000"
				value={draft}
			/>
			{!valid && (
				<ThemedText type="small" themeColor="danger">
					Enter an http:// or https:// address
				</ThemedText>
			)}
			<View style={styles.row}>
				<Button label="Test" onPress={test} disabled={!valid || health === 'checking'} />
				<Button label="Save" onPress={save} disabled={!valid} />
				<Button label="Reset" onPress={reset} variant="secondary" />
			</View>
			{health && <HealthBadge status={health} />}
			{message && (
				<ThemedText type="small" themeColor="textSecondary">
					{message}
				</ThemedText>
			)}
		</Screen>
	);
}

const styles = StyleSheet.create({
	row: { flexDirection: 'row', gap: Spacing.two },
});
