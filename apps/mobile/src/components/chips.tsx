import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ChipsProps = {
	values: string[];
	// Tapping a chip calls this; without it the chips are read-only.
	onPress?: (value: string) => void;
	selected?: (value: string) => boolean;
	hint?: string;
};

export function Chips({ values, onPress, selected, hint }: ChipsProps) {
	const theme = useTheme();
	return (
		<View style={styles.wrap}>
			{values.map((value) => {
				const on = selected?.(value) ?? false;
				return (
					<Pressable
						key={value}
						accessibilityRole={onPress ? 'button' : undefined}
						accessibilityHint={hint}
						accessibilityState={{ selected: on }}
						disabled={!onPress}
						onPress={() => onPress?.(value)}
						style={[
							styles.chip,
							{ backgroundColor: on ? theme.accent : theme.backgroundSelected },
						]}
					>
						<ThemedText type="small" style={on && styles.onLabel}>
							{value}
						</ThemedText>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one },
	chip: {
		borderRadius: Radius.medium,
		paddingHorizontal: Spacing.two,
		paddingVertical: Spacing.one,
	},
	onLabel: { color: '#ffffff' },
});
