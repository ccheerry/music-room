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
	// Children (buttons) sit next to the pressable area, never inside it.
	return (
		<View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
			<Pressable
				accessibilityRole={onPress ? 'button' : undefined}
				disabled={!onPress}
				onPress={onPress}
				style={({ pressed }) => [styles.text, pressed && styles.pressed]}
			>
				<ThemedText numberOfLines={1}>{title}</ThemedText>
				{subtitle ? (
					<ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
						{subtitle}
					</ThemedText>
				) : null}
			</Pressable>
			{children}
		</View>
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
