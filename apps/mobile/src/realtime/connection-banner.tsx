import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useSocketStatus } from '@/realtime/socket';
import { useTheme } from '@/hooks/use-theme';

// Shown in live screens while the realtime connection is down.
export function ConnectionBanner() {
	const theme = useTheme();
	const status = useSocketStatus((s) => s.status);
	if (status === 'online') return null;
	return (
		<View style={[styles.banner, { backgroundColor: theme.backgroundSelected }]}>
			<ThemedText type="small">
				{status === 'connecting'
					? 'Reconnecting… changes appear when back online'
					: 'Offline'}
			</ThemedText>
		</View>
	);
}

const styles = StyleSheet.create({
	banner: { borderRadius: Radius.small, padding: Spacing.two },
});
