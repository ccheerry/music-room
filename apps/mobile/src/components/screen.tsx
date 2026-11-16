import type { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { ScrollViewContainer } from 'react-native-reorderable-list';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
	children: ReactNode;
	// Hosts a NestedReorderableList: dragging an item scrolls the page.
	reorderable?: boolean;
};

// Scrollable page; automatic insets keep the content below the translucent iOS header.
export function Screen({ children, reorderable }: ScreenProps) {
	const theme = useTheme();
	const Scroll = reorderable ? ScrollViewContainer : ScrollView;
	return (
		<Scroll
			contentInsetAdjustmentBehavior="automatic"
			keyboardShouldPersistTaps="handled"
			style={{ backgroundColor: theme.background }}
			contentContainerStyle={styles.container}
		>
			{children}
		</Scroll>
	);
}

const styles = StyleSheet.create({
	container: { padding: Spacing.three, gap: Spacing.three },
});
