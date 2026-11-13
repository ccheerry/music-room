import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListRowProps = {
	title: string;
	subtitle?: string;
	onPress?: () => void;
	// Buttons or badges on the right.
	children?: ReactNode;
};

export function ListRow({ title, subtitle, onPress, children }: ListRowProps) {
	const theme = useTheme();
	return (
		<Pressable
			accessibilityRole={onPress ? 'button' : undefined}
			disabled={!onPress}
			onPress={onPress}
			style={({ pressed }) => [
				styles.row,
				{ backgroundColor: theme.backgroundElement },
				pressed && styles.pressed,
			]}
		>
			<View style={styles.text}>
				<ThemedText numberOfLines={1}>{title}</ThemedText>
				{subtitle ? (
					<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
						{subtitle}
					</ThemedText>
				) : null}
			</View>
			{children}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	row: {
		alignItems: 'center',
		borderRadius: Radius.medium,
		flexDirection: 'row',
		gap: Spacing.two,
		padding: Spacing.two,
	},
	text: { flex: 1 },
	pressed: { opacity: 0.7 },
});
