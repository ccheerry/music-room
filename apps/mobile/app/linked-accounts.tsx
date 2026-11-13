import type { Provider } from '@music-room/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getMe } from '@/api/auth';
import { errorMessage } from '@/api/errors';
import { linkProvider, unlinkProvider } from '@/api/social';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { socialEnabled } from '@/features/social/config';
import { ProviderButton } from '@/features/social/provider-buttons';

const PROVIDERS: { provider: Provider; name: string }[] = [
	{ provider: 'google', name: 'Google' },
	{ provider: 'facebook', name: 'Facebook' },
];

export default function LinkedAccountsScreen() {
	const me = useQuery({ queryKey: ['me'], queryFn: getMe });
	const [error, setError] = useState<string | null>(null);

	const run = async (action: () => Promise<void>) => {
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(errorMessage(err));
		}
	};

	if (!me.data) {
		return (
			<Screen>
				{me.isError && (
					<ThemedText themeColor="danger">{errorMessage(me.error)}</ThemedText>
				)}
			</Screen>
		);
	}

	return (
		<Screen>
			<ThemedText themeColor="textSecondary">
				Log in with any linked account. Password: {me.data.hasPassword ? 'set' : 'not set'}
			</ThemedText>
			{PROVIDERS.map(({ provider, name }) => {
				const linked = me.data.providers.includes(provider);
				return (
					<View key={provider} style={styles.row}>
						<ThemedText type="smallBold">
							{name}: {linked ? 'linked' : 'not linked'}
						</ThemedText>
						{linked ? (
							<Button
								label={`Unlink ${name}`}
								variant="secondary"
								onPress={() => run(() => unlinkProvider(provider))}
							/>
						) : socialEnabled[provider] ? (
							<ProviderButton
								provider={provider}
								label={`Link ${name}`}
								onToken={(token) => run(() => linkProvider(provider, token))}
							/>
						) : (
							<ThemedText type="small" themeColor="textSecondary">
								Not configured on this build
							</ThemedText>
						)}
					</View>
				);
			})}
			{error && <ThemedText themeColor="danger">{error}</ThemedText>}
		</Screen>
	);
}

const styles = StyleSheet.create({ row: { gap: Spacing.one } });
