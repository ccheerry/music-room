import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';

import { checkHealth, type HealthStatus } from '@/api/client';
import { Button } from '@/components/button';
import { HealthBadge } from '@/components/health-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_API_URL, useSettings } from '@/stores/settings';

const URL_PATTERN = /^https?:\/\/[^\s/]+(\/\S*)?$/i;

const normalize = (url: string) => url.trim().replace(/\/+$/, '');

export default function SettingsScreen() {
	const theme = useTheme();
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
		// automatic insets keep the content below the translucent iOS header
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
			style={{ backgroundColor: theme.background }}
			contentContainerStyle={styles.container}
		>
			<ThemedText type="smallBold">Backend address</ThemedText>
			<TextInput
				accessibilityLabel="Backend address"
				autoCapitalize="none"
				autoCorrect={false}
				inputMode="url"
				onChangeText={(text) => {
					setDraft(text);
					setHealth(null);
					setMessage(null);
				}}
				placeholder="http://192.168.1.10:3000"
				placeholderTextColor={theme.textSecondary}
				style={[
					styles.input,
					{ color: theme.text, backgroundColor: theme.backgroundElement },
				]}
				value={draft}
			/>
			{!valid && (
				<ThemedText type="small" themeColor="danger">
					Enter an http:// or https:// address
				</ThemedText>
			)}
			<ThemedView style={styles.row}>
				<Button label="Test" onPress={test} disabled={!valid || health === 'checking'} />
				<Button label="Save" onPress={save} disabled={!valid} />
				<Button label="Reset" onPress={reset} variant="secondary" />
			</ThemedView>
			{health && <HealthBadge status={health} />}
			{message && (
				<ThemedText type="small" themeColor="textSecondary">
					{message}
				</ThemedText>
			)}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { padding: Spacing.three, gap: Spacing.two },
	input: {
		...Typography.default,
		borderRadius: Radius.small,
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.two,
	},
	row: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
});
