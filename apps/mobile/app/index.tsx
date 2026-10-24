import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type Status = 'checking' | 'ok' | 'down';

export default function HomeScreen() {
	const [status, setStatus] = useState<Status>('checking');

	useEffect(() => {
		fetch(`${API_URL}/api/v1/health`)
			.then((res) => setStatus(res.ok ? 'ok' : 'down'))
			.catch(() => setStatus('down'));
	}, []);

	return (
		<ThemedView style={styles.container}>
			<SafeAreaView style={styles.safeArea}>
				<ThemedText type="title">Music Room</ThemedText>
				<ThemedText type="code">{API_URL}</ThemedText>
				<ThemedText>API: {status}</ThemedText>
			</SafeAreaView>
		</ThemedView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	safeArea: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
});
