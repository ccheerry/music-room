import { useQuery } from '@tanstack/react-query';
import { StyleSheet } from 'react-native';

import { checkHealth } from '@/api/client';
import { HealthBadge } from '@/components/health-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useSettings } from '@/stores/settings';

export default function HomeScreen() {
	const apiUrl = useSettings((s) => s.apiUrl);
	const health = useQuery({ queryKey: ['health', apiUrl], queryFn: () => checkHealth(apiUrl) });

	return (
		<ThemedView style={styles.container}>
			<ThemedText type="title">Music Room</ThemedText>
			<ThemedText type="code">{apiUrl}</ThemedText>
			<HealthBadge status={health.data ?? 'checking'} />
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
});
