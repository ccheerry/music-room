import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Scrollable page; automatic insets keep the content below the translucent iOS header.
export function Screen({ children }: { children: ReactNode }) {
	const theme = useTheme();
	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
			style={{ backgroundColor: theme.background }}
			contentContainerStyle={styles.container}
		>
			{children}
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	container: { padding: Spacing.three, gap: Spacing.three },
});
